require("dotenv").config()
const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const db = require("better-sqlite3")('shutter.db');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { render } = require("ejs");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const { error } = require("console");
const nodemailer = require('nodemailer');

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Razorpay configuration
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Database table creation
const createTableStmt = db.transaction(() => {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email STRING NOT NULL UNIQUE,
            password STRING NOT NULL,
            isAdmin BOOLEAN DEFAULT 0
        )
    `).run();
});

createTableStmt();

db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        price REAL,
        description TEXT,
        imageUrl TEXT,
        ownerid INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Add status column to products table if it doesn't exist
try {
    db.prepare(`
        ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'available'
    `).run();
    console.log('Status column added to products table');
} catch (error) {
    // Column might already exist, that's fine
    console.log('Status column may already exist');
}

db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        user_id INTEGER,
        payment_id TEXT,
        amount REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
`).run();

app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', './views');

// User authentication middleware
app.use((req, res, next) => {
    res.locals.errors = [];

    try {
        const decodedcookie = jwt.verify(req.cookies.User, process.env.JWTSECRET);
        
        // Fetch full user data from database including isAdmin
        const userFromDb = db.prepare("SELECT id, email, isAdmin FROM users WHERE id = ?").get(decodedcookie.userid);
        
        if (userFromDb) {
            req.user = {
                userid: userFromDb.id,
                mail: userFromDb.email,
                isAdmin: Boolean(userFromDb.isAdmin) // Convert to boolean
            };
        } else {
            req.user = false;
        }
    } catch (err) {
        req.user = false;
    }

    res.locals.user = req.user;
    next();
});

// Login route - include isAdmin in token
app.post('/login', (req, res) => {
    let errors = [];

    if (typeof req.body.email !== 'string') req.body.email = '';
    if (typeof req.body.password !== 'string') req.body.password = '';
    if (req.body.email.length < 6) errors = ['Email must be at least 6 characters'];
    if (req.body.password.length < 6) errors = ['Password must be at least 6 characters'];

    if (req.body.email && !req.body.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        errors = ['Email is not valid'];
    }

    if (errors.length > 0) {
        res.render('login', { errors });
        return;
    }

    const checkloginuser = db.prepare("SELECT * FROM users WHERE email = ?");
    const checklogin = checkloginuser.get(req.body.email);

    if (!checklogin) {
        errors = ["User does not exist"];
        return res.render('login', { errors });
    }

    const checkpassmatch = bcrypt.compareSync(req.body.password, checklogin.password);
    if (!checkpassmatch) {
        errors = ["Incorrect Password"];
        return res.render('login', { errors });
    }

    // Include isAdmin in JWT token
    const usertoken = jwt.sign(
        {
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
            userid: checklogin.id,
            mail: checklogin.email,
            isAdmin: Boolean(checklogin.isAdmin)
        },
        process.env.JWTSECRET
    );

    res.cookie("User", usertoken, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 1
    });

    res.redirect('/');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register_js', (req, res) => {
    errors = [];

    if (typeof req.body.email !== 'string') req.body.email = '';
    if (typeof req.body.password !== 'string') req.body.password = '';
    if (req.body.email.length < 6) errors.push('Email must be at least 6 characters');
    if (req.body.password.length < 6) errors.push('Password must be at least 6 characters');

    if (req.body.email && !req.body.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        errors.push('Email is not valid');
    }

    const checkunique = db.prepare("SELECT * FROM users WHERE email = ?");
    const verifymail = checkunique.get(req.body.email);

    if (verifymail) {
        errors.push("Email already exists");
    }

    if (errors.length > 0) {
        res.render('register', { errors });
        return;
    }

    const salt = bcrypt.genSaltSync(10);
    req.body.password = bcrypt.hashSync(req.body.password, salt);

    const stmt1 = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
    const result = stmt1.run(req.body.email, req.body.password);

    const lookup = db.prepare("SELECT * FROM users WHERE ROWID = ?")
    const ourUser = lookup.get(result.lastInsertRowid)

    const usertoken = jwt.sign(
        {
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
            userid: ourUser.id,
            mail: ourUser.email,
            isAdmin: Boolean(ourUser.isAdmin)
        },
        process.env.JWTSECRET
    );

    res.cookie("User", usertoken, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 1
    });

    res.redirect('/');
});

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login');
});

function kick(req, res, next) {
    if (req.user) {
        return next();
    }
    const expectsJson = req.xhr ||
        (req.headers['accept'] && req.headers['accept'].includes('application/json')) ||
        (req.headers['content-type'] && req.headers['content-type'].includes('application/json'));
    if (expectsJson) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    return res.redirect('/');
}

// Admin middleware
function isAdmin(req, res, next) {
    console.log('Admin check:', req.user); // Debug log
    if (req.user && req.user.isAdmin === true) {
        return next();
    }
    return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin rights required.' 
    });
}

app.get('/dashboard', kick, isAdmin, (req, res) => {
    const decodedmail = jwt.verify(req.cookies.User, process.env.JWTSECRET);
    const fetchname = decodedmail.mail;
    res.render('dashboard', { fetchname });
});

app.post('/dashboard', kick, isAdmin, upload.single('productImage'), (req, res) => {
    let errors = [];
    const { productName, productCategory, productPrice, productDescription } = req.body;

    if (!productName) errors.push("Product name is required");
    if (!productCategory) errors.push("Category is required");
    if (!productPrice) errors.push("Price is required");
    if (!req.file) errors.push("Image is required");

    if (errors.length > 0) {
        return res.render('dashboard', {
            errors,
            fetchname: req.user.mail
        });
    }

    try {
        const imageUrl = '/uploads/' + req.file.filename;

        db.prepare(`
            INSERT INTO products (name, category, price, description, imageUrl, ownerid, status)
            VALUES (?, ?, ?, ?, ?, ?, 'available')
        `).run(
            productName,
            productCategory,
            productPrice,
            productDescription,
            imageUrl,
            req.user.userid
        );

        return res.redirect('/products');
    } catch (error) {
        console.error('Database error:', error);
        errors.push("Failed to save product");
        return res.render('dashboard', {
            errors,
            fetchname: req.user.mail
        });
    }
});

app.get("/logout", (req, res) => {
    res.cookie("User", "", {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        expires: new Date(0)
    });
    res.redirect('/');
});

app.get('/products', (req, res) => {
    try {
        const products = db.prepare(`
            SELECT p.*, u.email as owner_email 
            FROM products p 
            LEFT JOIN users u ON p.ownerid = u.id 
            ORDER BY p.created_at DESC
        `).all();

        return res.render('products', {
            products,
            user: req.user,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).send('Error loading products');
    }
});

// Update product status route
app.patch('/products/:id/status', kick, isAdmin, (req, res) => {
    try {
        const { status } = req.body;
        const productId = req.params.id;
        
        const validStatuses = ['available', 'rented', 'maintenance', 'unavailable'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        db.prepare('UPDATE products SET status = ? WHERE id = ?').run(status, productId);

        res.json({ 
            success: true, 
            message: 'Status updated successfully' 
        });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating status' 
        });
    }
});

app.post('/create-order', kick, (req, res) => {
    try {
        const { productId, amount } = req.body;

        const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
        if (!product) {
            return res.status(400).json({ error: 'Product not found' });
        }

        // Check if product is available
        if (product.status !== 'available') {
            return res.status(400).json({ error: 'Product is not available for rent' });
        }

        const options = {
            amount: amount * 100,
            currency: 'INR',
            receipt: `order_${productId}_${Date.now()}`,
            payment_capture: 1
        };

        razorpay.orders.create(options, (err, order) => {
            if (err) {
                console.error('Razorpay order creation failed:', err);
                return res.status(500).json({ error: 'Failed to create order' });
            }

            res.json({
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                key: process.env.RAZORPAY_KEY_ID
            });
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/process-payment', kick, (req, res) => {
    try {
        const { productId, paymentId, orderId, signature, amount } = req.body;

        const crypto = require('crypto');
        const body = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === signature) {
            const result = db.prepare(`
                INSERT INTO orders (product_id, user_id, payment_id, amount, status)
                VALUES (?, ?, ?, ?, 'completed')
            `).run(productId, req.user.userid, paymentId, amount);

            // Optionally update product status to 'rented' after successful payment
            db.prepare('UPDATE products SET status = ? WHERE id = ?').run('rented', productId);

            res.json({
                success: true,
                message: 'Payment successful and rental confirmed!',
                orderId: result.lastInsertRowid
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Payment verification failed'
            });
        }
    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment processing failed'
        });
    }
});

app.get('/about', (req, res) => {
    res.render('about')
});

app.get('/contact', (req, res) => {
    res.render('contact', {
        errors: [],
        success: '',
        formData: {}
    });
});

app.post('/contact', (req, res) => {
    let errors = [];
    const { name, email, subject, message } = req.body;

    if (!name || typeof name !== 'string') {
        errors.push('Name is required');
    } else if (name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    }

    if (!email || typeof email !== 'string') {
        errors.push('Email is required');
    } else if (!email.match(/^[a-zA-Z0-9._%+-]+@vit.edu.in$/)) {
        errors.push('Please enter a valid email address');
    }

    if (!subject || typeof subject !== 'string') {
        errors.push('Subject is required');
    } else if (subject.trim().length < 5) {
        errors.push('Subject must be at least 5 characters long');
    }

    if (!message || typeof message !== 'string') {
        errors.push('Message is required');
    } else if (message.trim().length < 10) {
        errors.push('Message must be at least 10 characters long');
    }

    if (errors.length > 0) {
        return res.render('contact', {
            errors,
            formData: { name, email, subject, message }
        });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: 'csharma162005@gmail.com',
            pass: process.env.GOOGLE_APP_PASSWORD
        }
    });

    const mailOptions = {
        from: {
            name: name,
            address: email
        },
        to: 'chiragps2005@gmail.com',
        subject: subject,
        text: message,
        html: `<b>Name: ${name}<br>Email: ${email}<br>Message: ${message}</b>`
    };

    const sendEmail = async (transporter, mailOptions) => {
        try {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully!');
        } catch (error) {
            console.error('Error sending email:', error);
        }
    };

    sendEmail(transporter, mailOptions);

    res.render('contact', {
        success: 'Thank you for your message. We will get back to you soon!',
        formData: {}
    });
});

// Delete product route with proper admin check
app.delete('/products/:id', kick, isAdmin, (req, res) => {
    console.log('Delete request received for product ID:', req.params.id); // Debug log
    
    try {
        const productId = Number(req.params.id);
        if (!Number.isFinite(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product id' });
        }
        
        // Get the product first
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);

        if (!product) {
            console.log('Product not found:', productId);
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        console.log('Product found:', product); // Debug log

        // Delete related rows first (orders), then the product, inside a transaction
        const deleteProductTx = db.transaction((id) => {
            db.prepare('DELETE FROM orders WHERE product_id = ?').run(id);
            return db.prepare('DELETE FROM products WHERE id = ?').run(id);
        });
        const deleteResult = deleteProductTx(productId);
        console.log('Database delete result:', deleteResult); // Debug log

        // Try to delete the image file if it exists
        if (product.imageUrl) {
            try {
                // Remove leading slash if present
                const imageFileName = product.imageUrl.replace(/^\//, '');
                const imagePath = path.join(__dirname, 'public', imageFileName);
                
                console.log('Attempting to delete image at:', imagePath); // Debug log
                
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                    console.log('Image deleted successfully');
                } else {
                    console.log('Image file not found at path:', imagePath);
                }
            } catch (imageError) {
                // Log the error but don't fail the entire delete operation
                console.error('Error deleting image file:', imageError);
                // Continue anyway - the database record is deleted
            }
        }

        res.json({ 
            success: true, 
            message: 'Product deleted successfully' 
        });
        
    } catch (error) {
        console.error('Error in delete route:', error);
        console.error('Error stack:', error.stack); // More detailed error info
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting product',
            error: error.message // Include error message for debugging
        });
    }
});

app.post('/make-admin', kick, isAdmin, (req, res) => {
    try {
        const { userId } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        db.prepare('UPDATE users SET isAdmin = 1 WHERE id = ?').run(userId);

        res.json({ 
            success: true, 
            message: 'User is now an admin' 
        });
    } catch (error) {
        console.error('Error making user admin:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating user' 
        });
    }
});

// Make initial admin - wrap in try/catch
try {
    db.prepare('UPDATE users SET isAdmin = 1 WHERE email = ?').run('admin@mail.com');
    console.log('Admin user updated successfully');
} catch (error) {
    console.log('Note: Could not update admin user (user may not exist yet)');
}

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(3001, () => {
    console.log('Server is running on port 3001');
}).on('error', (err) => {
    console.error('Server failed to start:', err);
});