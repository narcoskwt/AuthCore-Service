# AuthCore-Service

A production-grade authentication service built with Express.js and TypeScript, providing secure JWT-based authentication with refresh token rotation, rate limiting, account lockout, and comprehensive security features.

## Features

- 🔐 JWT-based authentication with access and refresh tokens
- 🔄 Refresh token rotation with reuse detection
- 🚫 Account lockout after failed login attempts
- ⏱️ Rate limiting for authentication endpoints
- 🔒 Permission-based authorization (RBAC)
- 📝 Comprehensive audit logging
- 🛡️ Security hardening with Helmet, XSS protection, and more

## Tech Stack

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: MySQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: Argon2

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Yarn package manager
- MySQL database

### Installation

1. Clone the repository:
```bash
git clone https://github.com/JAYKEv/AuthCore-Service.git
  cd AuthCore-Service
```

2. Install dependencies:
```bash
  yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
  yarn dev
```

## API Endpoints

- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/forgot-password` - Request password reset
- `POST /api/v1/reset-password/:token` - Reset password
- `POST /api/v1/send-verification-email` - Send email verification
- `POST /api/v1/verify-email/:token` - Verify email address

## Environment Variables

See `.env.example` for required environment variables.

## Author

**Jaykumar Kevadiya**  
Email: kevadiyj@uwindsor.ca
