# ShutterShare - Professional Camera Rental Platform

A full-stack web application for renting professional camera equipment, built as a college project. This platform allows users to browse, rent, and manage camera gear while providing admin functionality for inventory management.

## 🎯 Project Overview

ShutterShare is a comprehensive camera rental platform designed to bridge the gap between aspiring photographers/filmmakers and professional equipment. The platform enables students and creators to access high-quality camera gear without the financial burden of purchasing expensive equipment.

## ✨ Features

### User Features
- **User Authentication**: Secure registration and login system with JWT tokens
- **Product Browsing**: View all available camera equipment with detailed information
- **Product Filtering**: Filter products by category (Camera Body, Lens, Drone, Accessory)
- **Product Status**: Real-time status tracking (Available, Rented, Maintenance, Unavailable)
- **Payment Integration**: Secure payment processing via Razorpay
- **Contact System**: Email-based contact form for support inquiries
- **Responsive Design**: Mobile-friendly interface

### Admin Features
- **Dashboard**: Comprehensive admin panel for inventory management
- **Product Management**: Add, edit, and delete products
- **Status Management**: Update product availability status
- **User Management**: Promote users to admin status
- **Order Tracking**: Monitor rental transactions

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database (better-sqlite3)
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **Multer** - File upload handling
- **Razorpay** - Payment gateway
- **Nodemailer** - Email service

### Frontend
- **EJS** - Template engine
- **CSS3** - Styling
- **JavaScript** - Client-side functionality
- **Razorpay Checkout** - Payment UI

### Database Schema
- **Users Table**: User authentication and admin privileges
- **Products Table**: Equipment inventory with status tracking
- **Orders Table**: Rental transaction records

## 📁 Project Structure

```
shuttershare/
├── public/
│   ├── style.css          # Main stylesheet
│   └── uploads/           # Product images storage
├── views/
│   ├── includes/
│   │   └── header.ejs     # Common header template
│   ├── index.ejs          # Homepage
│   ├── about.ejs          # About page
│   ├── contact.ejs        # Contact page
│   ├── products.ejs       # Product listing page
│   ├── dashboard.ejs      # Admin dashboard
│   ├── login.ejs          # Login page
│   └── register.ejs       # Registration page
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── shutter.db             # SQLite database
└── README.md              # Project documentation
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd shuttershare
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with the following variables:
   ```env
   JWTSECRET=your_jwt_secret_key
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   GOOGLE_APP_PASSWORD=your_gmail_app_password
   ```

4. **Database Setup**
   The SQLite database will be automatically created on first run. The application includes:
   - User table with admin privileges
   - Product table with status tracking
   - Order table for rental records

5. **Start the application**
   ```bash
   npm start
   # or for development with auto-restart
   npx nodemon server.js
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3001`

## 🔧 Configuration

### Razorpay Setup
1. Create a Razorpay account at [razorpay.com](https://razorpay.com)
2. Get your API keys from the dashboard
3. Add them to your `.env` file

### Email Configuration
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password for the application
3. Add the App Password to your `.env` file

### Admin User Setup
The application automatically promotes the user with email `admin@mail.com` to admin status. You can also promote other users through the admin dashboard.

## 📱 Usage Guide

### For Regular Users
1. **Register/Login**: Create an account or log in with existing credentials
2. **Browse Products**: View available camera equipment on the products page
3. **Rent Equipment**: Click "Rent Now" on available items to proceed with payment
4. **Contact Support**: Use the contact form for any inquiries

### For Admins
1. **Access Dashboard**: Log in with admin credentials to access the dashboard
2. **Add Products**: Use the form to add new equipment to inventory
3. **Manage Status**: Update product availability status
4. **Delete Products**: Remove items from inventory
5. **User Management**: Promote users to admin status

## 🔒 Security Features

- **Password Hashing**: bcrypt for secure password storage
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Server-side validation for all user inputs
- **File Upload Security**: Restricted file types and secure storage
- **Payment Verification**: Cryptographic signature verification for payments

## 🎨 Design Features

- **Responsive Layout**: Mobile-first design approach
- **Modern UI**: Clean and professional interface
- **Status Indicators**: Visual status badges for product availability
- **Modal Windows**: Smooth user interactions for product details and payments
- **Loading States**: User feedback during payment processing

## 🚧 API Endpoints

### Authentication
- `POST /register_js` - User registration
- `POST /login` - User login
- `GET /logout` - User logout

### Products
- `GET /products` - List all products
- `POST /dashboard` - Add new product (Admin only)
- `PATCH /products/:id/status` - Update product status (Admin only)
- `DELETE /products/:id` - Delete product (Admin only)

### Payments
- `POST /create-order` - Create Razorpay order
- `POST /process-payment` - Verify and process payment

### Contact
- `GET /contact` - Contact page
- `POST /contact` - Submit contact form

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure SQLite is properly installed
   - Check file permissions for the database file

2. **Payment Integration Issues**
   - Verify Razorpay credentials in `.env`
   - Check network connectivity

3. **Email Not Sending**
   - Verify Gmail App Password
   - Check 2FA is enabled on Gmail account

4. **File Upload Issues**
   - Ensure `public/uploads` directory exists
   - Check file permissions

## 🤝 Contributing

This is a college project, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.

## 👨‍💻 Author

**Chirag Sharma**
- Email: csharma162005@gmail.com
- Project: College Assignment

## 🙏 Acknowledgments

- Razorpay for payment integration
- Express.js community for excellent documentation
- SQLite for lightweight database solution

## 📞 Support

For support or questions about this project, please contact:
- Email: chiragps2005@gmail.com
- Or use the contact form on the website

---

**Note**: This is a college project created for educational purposes. The application demonstrates full-stack web development skills including authentication, payment processing, file handling, and database management.
