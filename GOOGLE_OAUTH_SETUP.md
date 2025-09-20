# Google OAuth Setup Guide

## 1. Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (or Google Identity API)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure the OAuth consent screen if prompted
6. Create a Web application client ID
7. Add authorized redirect URIs:
   - For development: `http://localhost:3000/auth/google/callback`
   - For production: `https://yourdomain.com/auth/google/callback`

## 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

## 3. Test the Integration

1. Start the server: `npm start`
2. Visit: `http://localhost:3000`
3. Click "Sign in with Google" on the login page
4. Complete the OAuth flow

## 4. Database Features

The system now includes:

- **SQLite Database**: Stores user accounts and negotiation history
- **User Registration**: Create accounts with username/email/password
- **Google OAuth**: Sign in with Google accounts
- **Password Hashing**: Secure bcrypt password storage
- **JWT Authentication**: Token-based session management
- **User Negotiations**: Track all negotiations per user

## 5. Default Users

The system creates default users on first run:
- **Username**: `admin` **Password**: `vapi123`
- **Username**: `user` **Password**: `vapi123`

## 6. Database Schema

### Users Table
- `id`: Primary key
- `username`: Unique username
- `email`: Unique email address
- `password`: Hashed password (null for Google users)
- `google_id`: Google OAuth ID (null for regular users)
- `role`: User role (admin/user)
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

### Negotiations Table
- `id`: Primary key
- `user_id`: Foreign key to users table
- `negotiation_id`: Unique negotiation identifier
- `phone_number`: Customer service phone number
- `user_message`: User's request message
- `order_number`: Order number (if provided)
- `screenshot_url`: Path to uploaded screenshot
- `status`: Negotiation status (pending/in_progress/completed/error)
- `result`: Negotiation result JSON
- `vapi_call_id`: Vapi call identifier
- `created_at`: Negotiation start timestamp
- `updated_at`: Last update timestamp

## 7. API Endpoints

### Authentication
- `POST /auth/login` - Login with username/password
- `POST /auth/register` - Register new user
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/verify` - Verify JWT token
- `POST /auth/logout` - Logout user

### Negotiations
- `POST /start` - Start new negotiation (requires auth)
- `GET /status/:id` - Get negotiation status (requires auth)
- `POST /log` - Webhook for Vapi results (requires auth)

All endpoints now require authentication except login/register/OAuth.
