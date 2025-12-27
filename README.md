<div align="center">

  <h1>AuthCore-Service</h1>
  
  <p>
A production-grade authentication service built with Express.js and TypeScript, providing secure JWT-based authentication with refresh token rotation, rate limiting, account lockout, permission-based authorization, and comprehensive security features.
  </p>
  
<!-- Badges -->
<p>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-green.svg" alt="Node.js" />
</p>
</div>

<!-- Table of Contents -->

# Table of Contents

- [Table of Contents](#table-of-contents)
  - [About the Project](#about-the-project)
    - [Tech Stack](#tech-stack)
    - [Security Features](#security-features)
    - [Features](#features)
    - [Endpoints](#endpoints)
    - [Project Structure](#project-structure)
    - [Architecture Decisions](#architecture-decisions)
    - [Threat Model](#threat-model)
    - [API Authentication Flow](#api-authentication-flow)
    - [Database](#database)
      - [Account](#account)
      - [User](#user)
      - [RefreshToken](#refreshtoken)
      - [ResetToken](#resettoken)
      - [EmailVerificationToken](#emailverificationtoken)
      - [Permission & Role Models](#permission--role-models)
      - [AuthAuditLog](#authauditlog)
    - [Refresh Token Rotation & Reuse Detection](#refresh-token-rotation--reuse-detection)
    - [Environment Variables](#environment-variables)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Linting](#linting)
    - [Running Tests](#running-tests)
    - [Run Locally](#run-locally)
    - [Run with Docker](#run-with-docker)
  - [Roadmap](#roadmap)
  - [Contributing](#contributing)
    - [Code of Conduct](#code-of-conduct)
  - [License](#license)
  - [Contact](#contact)
  - [Acknowledgements](#acknowledgements)

<!-- About the Project -->

## About the Project

AuthCore-Service is a production-ready authentication service designed to provide enterprise-grade security for web and mobile applications. Built with Express.js and TypeScript, it implements industry best practices for authentication, including JWT-based sessions, refresh token rotation with reuse detection, rate limiting, account lockout mechanisms, permission-based authorization, and comprehensive audit logging.

This service prioritizes security without sacrificing usability, providing a robust foundation for authentication that can be easily integrated into any application stack.

**Author:** Jaykumar Kevadiya  
**Email:** kevadiyj@uwindsor.ca

<!-- TechStack -->

### Tech Stack

<p align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=ts,nodejs,express,mysql,docker,prisma&perline=13" />
  </a>
</p>

<!-- Features -->

### Security Features

- 🔒 **Refresh Token Reuse Detection**: Implements token families to detect and prevent token reuse attacks
- 🚫 **Account Lockout**: Automatic account locking after 5 failed login attempts (15-minute lockout)
- ⏱️ **Rate Limiting**: 5 requests per 15 minutes for login and refresh endpoints (prevents brute force attacks)
- 🔐 **Permission-Based Authorization**: Fine-grained access control with roles and permissions
- 📝 **Audit Logging**: Comprehensive audit trail for all authentication events
- 🍪 **Secure Cookies**: HTTP-only, secure cookies with SameSite protection (CSRF prevention)
- 🔑 **Dual Authentication Support**: Supports both cookie-based and Authorization header authentication
- 🛡️ **Token Family Management**: All tokens from a login session share a family ID for reuse detection
- 🔄 **Token Rotation**: Automatic refresh token rotation on each use

### Features

- :black_nib: Written in TypeScript for type-safe code
- :floppy_disk: Utilize a MySQL database to efficiently store user data
- :speaking_head: Interacts with the database using the powerful Prisma ORM
- :lock: Implements secure authentication measures with JWTs, ensuring secure access to sensitive data
- :key: Implements robust password hashing using Argon2 for maximum security
- :recycle: Incorporates refresh token rotation functionality to enhance the security
- :white_check_mark: Includes email verification functionality for new user sign-ups
- :new: Provides a reset password function for users who have forgotten their password
- :rabbit2: Enables faster data transfer by implementing GZIP compression
- :policeman: Implements essential security features using Helmet middleware
- :cookie: Parses cookies seamlessly with cookie-parser middleware
- :gear: Allows cross-origin resource sharing using CORS
- :soap: Sanitizes request data against cross-site-scripting with xss middleware
- :capital_abcd: Manages environment variables with ease using dotenv
- :male_detective: Enforces high code quality standards with ESLint and Prettier
- :horse_racing: Implements rate limiting to prevent abuse and improve server performance
- :information_source: Accurately manages HTTP response status codes using http-status library
- :warning: Validates user input with the powerful and flexible Joi library
- :email: Facilitates sending of emails using nodemailer library
- :memo: Enables detailed logging of server activities using winston library
- :dog: Implements Git hooks with Husky to optimize development processes
- :test_tube: Ensure reliability and robustness of the application with thorough testing using Jest and Supertest

<!-- Endpoints -->

### Endpoints

```
POST /v1/auth/signup - Signup
POST /v1/auth/login - Login (Rate limited: 5 req/15min)
POST /v1/auth/refresh - Refresh access token (Rate limited: 5 req/15min)
POST /v1/auth/logout - Logout
POST /v1/forgot-password - Send reset password email
POST /v1/reset-password/:token - Reset password
POST /v1/send-verification-email - Send verification email
POST /v1/verify-email/:token - Verify email
```

#### Using Permission-Based Authorization

To protect routes with permissions, use the `requirePermission` middleware:

```typescript
import { Router } from 'express';
import isAuth from '../middleware/isAuth';
import { requirePermission } from '../middleware/requirePermission';
import { requireAuthAndPermission } from '../middleware/requirePermission';

const router = Router();

// Option 1: Use isAuth and requirePermission separately
router.get('/admin', isAuth, requirePermission('ADMIN_PANEL_ACCESS'), handler);

// Option 2: Use the combined middleware
router.get('/users', requireAuthAndPermission('USER_READ'), handler);
router.post('/users', requireAuthAndPermission('USER_WRITE'), handler);
```

**Example Permissions:**
- `USER_READ` - Read user data
- `USER_WRITE` - Create/update user data
- `ADMIN_PANEL_ACCESS` - Access admin panel
- `MANAGE_ROLES` - Manage user roles and permissions

**Setting up Permissions:**

1. Create permissions in the database:
```typescript
await prismaClient.permission.create({
  data: { name: 'USER_READ', description: 'Read user data' }
});
```

2. Create roles and assign permissions:
```typescript
const adminRole = await prismaClient.role.create({
  data: {
    name: 'ADMIN',
    rolePermissions: {
      create: [
        { permission: { connect: { name: 'USER_READ' } } },
        { permission: { connect: { name: 'ADMIN_PANEL_ACCESS' } } }
      ]
    }
  }
});
```

3. Assign roles to users:
```typescript
await prismaClient.userRole.create({
  data: {
    user: { connect: { id: userId } },
    role: { connect: { id: adminRole.id } }
  }
});
```

<!-- Project Structure -->

### Project Structure

```
./src
├── config/         # Config files
├── controller/     # Route controllers
├── middleware/     # Custom middlewares
├── routes/         # Routes
├── types/          # Types
├── utils/          # Utility classes and functions
├── validations/    # Validation schemas
├── app.ts          # Express App
└── index.ts        # App Entrypoint
```

<!-- Architecture Decisions -->

### Architecture Decisions

#### Token Family System
- **Decision**: Implement token families for refresh token reuse detection
- **Rationale**: When a refresh token is stolen and reused, we can detect it by checking if the token belongs to a family that has already been used. This allows us to revoke all tokens in the compromised family and force re-authentication.
- **Implementation**: Each login session generates a unique `tokenFamilyId`. All refresh tokens from that session share the same family ID. If any token in a family is reused, all tokens in that family are revoked.

#### Account Lockout Mechanism
- **Decision**: Lock accounts after 5 failed login attempts for 15 minutes
- **Rationale**: Prevents brute force attacks while allowing legitimate users to recover access after a short period. The lockout duration is short enough to not significantly impact user experience but long enough to deter automated attacks.
- **Implementation**: Failed attempts are tracked per user. On successful login, counters are reset. Locked accounts cannot authenticate until the lockout period expires.

#### Rate Limiting Strategy
- **Decision**: Apply rate limiting only to authentication endpoints (login, refresh)
- **Rationale**: Authentication endpoints are the primary targets for brute force attacks. Other endpoints don't need the same level of protection, reducing false positives and improving user experience.
- **Implementation**: 5 requests per 15 minutes per IP address using express-rate-limit. Can be extended to use Redis for distributed systems.

#### Permission-Based Authorization
- **Decision**: Use role-based access control (RBAC) with permissions
- **Rationale**: Provides fine-grained access control. Users can have multiple roles, and roles can have multiple permissions. This allows for flexible permission management without modifying code.
- **Implementation**: Three-tier system: Users → Roles → Permissions. Middleware checks if user has required permission through their roles.

#### Dual Authentication Support
- **Decision**: Support both cookie-based and Authorization header authentication
- **Rationale**: Cookies are convenient for web applications, while Authorization headers are standard for APIs and mobile applications. Supporting both provides flexibility.
- **Implementation**: Refresh tokens can be sent via cookies or Authorization header. Access tokens are always sent via Authorization header.

#### Audit Logging
- **Decision**: Log all authentication events with IP address and user agent
- **Rationale**: Provides security monitoring, compliance, and forensic capabilities. Helps detect suspicious patterns and investigate security incidents.
- **Implementation**: Structured logging to database with event types, timestamps, user IDs, IP addresses, and user agents.

<!-- Threat Model -->

### Threat Model

This service addresses the following security threats:

#### 1. Brute Force Attacks
- **Threat**: Attackers attempt to guess user passwords through repeated login attempts
- **Mitigation**: 
  - Rate limiting (5 requests per 15 minutes)
  - Account lockout after 5 failed attempts
  - Password hashing with Argon2 (computationally expensive)

#### 2. Token Theft & Replay Attacks
- **Threat**: Stolen refresh tokens used to gain unauthorized access
- **Mitigation**:
  - Token family system detects reuse
  - Automatic revocation of all tokens in compromised family
  - Token rotation on each refresh
  - Secure, HTTP-only cookies prevent XSS-based theft

#### 3. Cross-Site Request Forgery (CSRF)
- **Threat**: Unauthorized actions performed using authenticated user's session
- **Mitigation**:
  - SameSite cookie attribute (strict/lax)
  - CSRF tokens (can be added for additional protection)
  - Authorization header support (not vulnerable to CSRF)

#### 4. Cross-Site Scripting (XSS)
- **Threat**: Malicious scripts steal tokens or perform unauthorized actions
- **Mitigation**:
  - HTTP-only cookies (JavaScript cannot access)
  - XSS sanitization middleware
  - Content Security Policy headers (via Helmet)

#### 5. Session Fixation
- **Threat**: Attackers force users to use a known session token
- **Mitigation**:
  - Token rotation on each refresh
  - New token family on each login
  - Token invalidation on logout

#### 6. User Enumeration
- **Threat**: Attackers determine if an email exists in the system
- **Mitigation**:
  - Generic error messages ("Invalid email or password")
  - Password verification always performed (even for non-existent users)
  - Timing attack prevention through consistent response times

<!-- API Authentication Flow -->

### API Authentication Flow

```
┌─────────┐                                    ┌──────────────┐
│ Client │                                    │ Auth Service │
└───┬─────┘                                    └──────┬───────┘
    │                                                  │
    │  1. POST /auth/login                            │
    │     { email, password }                         │
    ├─────────────────────────────────────────────────>│
    │                                                  │
    │                                                  │ 2. Verify credentials
    │                                                  │ 3. Check account lockout
    │                                                  │ 4. Generate tokenFamilyId
    │                                                  │ 5. Create access token (JWT)
    │                                                  │ 6. Create refresh token (JWT)
    │                                                  │ 7. Store refresh token with family ID
    │                                                  │ 8. Log LOGIN_SUCCESS event
    │                                                  │
    │  9. Response:                                  │
    │     { accessToken }                            │
    │     Set-Cookie: refreshToken (httpOnly)        │
    ├<────────────────────────────────────────────────┤
    │                                                  │
    │  [Client stores accessToken in memory]          │
    │  [Refresh token stored in httpOnly cookie]      │
    │                                                  │
    │  10. API Request                                │
    │      Authorization: Bearer <accessToken>       │
    ├─────────────────────────────────────────────────>│
    │                                                  │ 11. Verify access token
    │                                                  │ 12. Check permissions (if required)
    │                                                  │
    │  13. Response: { data }                         │
    ├<────────────────────────────────────────────────┤
    │                                                  │
    │  [Access token expires]                          │
    │                                                  │
    │  14. POST /auth/refresh                         │
    │      Cookie: refreshToken                       │
    │      OR                                         │
    │      Authorization: Bearer <refreshToken>       │
    ├─────────────────────────────────────────────────>│
    │                                                  │ 15. Verify refresh token exists in DB
    │                                                  │ 16. Check token family for reuse
    │                                                  │ 17. Delete old refresh token
    │                                                  │ 18. Generate new access token
    │                                                  │ 19. Generate new refresh token
    │                                                  │     (same tokenFamilyId)
    │                                                  │ 20. Store new refresh token
    │                                                  │ 21. Log REFRESH_TOKEN_USED event
    │                                                  │
    │  22. Response:                                  │
    │      { accessToken }                            │
    │      Set-Cookie: refreshToken (httpOnly)        │
    ├<────────────────────────────────────────────────┤
    │                                                  │
    │  [If token reuse detected]                       │
    │                                                  │
    │  23. POST /auth/refresh (with stolen token)     │
    ├─────────────────────────────────────────────────>│
    │                                                  │ 24. Token not in DB (reuse detected)
    │                                                  │ 25. Verify token is valid JWT
    │                                                  │ 26. Revoke ALL tokens in family
    │                                                  │ 27. Delete all user's tokens
    │                                                  │ 28. Log TOKEN_REUSE_DETECTED event
    │                                                  │
    │  29. Response: 403 Forbidden                    │
    │      { message: "Token reuse detected..." }     │
    ├<────────────────────────────────────────────────┤
    │                                                  │
    │  30. POST /auth/logout                          │
    ├─────────────────────────────────────────────────>│
    │                                                  │ 31. Delete refresh token from DB
    │                                                  │ 32. Log LOGOUT event
    │                                                  │
    │  33. Response: 204 No Content                    │
    │      Clear-Cookie: refreshToken                  │
    ├<────────────────────────────────────────────────┤
```

<!-- Database -->

### Database

Our server relies on MySQL as its primary database management system to store and manage all relevant data. MySQL is a popular and widely used open-source relational database system that provides efficient, secure, and scalable storage and retrieval of data.

To simplify and streamline the process of managing the data stored in the MySQL database, we utilize Prisma, which is a modern, type-safe ORM that supports various databases, including MySQL.

Prisma helps us to write database queries in a more readable and intuitive way, making it easier to manage the data stored in our MySQL database. By using Prisma as our ORM of choice, we can also ensure that our application remains scalable, efficient, and maintainable.

If you're interested in the structure of our database, you can take a look at the data model presented below, which provides an overview of the tables, columns, and relationships within the database.

```js

model Account {
  id                String   @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?  @db.Text
  access_token      String?  @db.Text
  expiresAt         DateTime
  token_type        String?
  scope             String?
  id_token          String?  @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model User {
  id                     String                   @id @default(cuid())
  name                   String
  email                  String?                  @unique
  password               String
  emailVerified          DateTime?
  createdAt              DateTime                 @default(now())
  // Security: Account lockout fields
  failedLoginAttempts    Int                      @default(0)
  lockedUntil            DateTime?
  accounts               Account[]
  refreshTokens          RefreshToken[]
  resetToken             ResetToken[]
  emailVerificationToken EmailVerificationToken[]
  userRoles              UserRole[]
  auditLogs              AuthAuditLog[]
}

model RefreshToken {
  id            String   @id @default(cuid())
  token         String   @unique
  // Security: Token family for reuse detection
  tokenFamilyId String
  // Security: Track if token was revoked
  revoked       Boolean  @default(false)
  user          User     @relation(fields: [userId], references: [id])
  userId        String
  createdAt     DateTime @default(now())
  
  @@index([tokenFamilyId])
  @@index([userId])
}

model ResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  createdAt DateTime @default(now())
}

model EmailVerificationToken {
  id        String   @id @default(cuid())
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  createdAt DateTime @default(now())
}
```

#### Account

> Social auth is not yet implemented so that the entity can be different in the future

The Account entity represents a linked social media account for a user. It has the following fields:

- id: A unique identifier for the account.
- userId: The ID of the user associated with the account.
- type: The type of account, e.g. oauth.
- provider: The provider of the account, e.g. facebook.
- providerAccountId: The ID associated with the account from the provider's perspective.
- refresh_token: A refresh token used to obtain a new access token.
- access_token: An access token used to authenticate requests to the provider's API.
- expiresAt: The expiration time of the access token.
- token_type: The type of access token.
- scope: The scope of the access token.
- id_token: An ID token associated with the account.
- session_state: The session state of the account.

#### User

The User entity represents a user of the application. It has the following fields:

- id: A unique identifier for the user.
- name: The name of the user.
- email: The email address of the user.
- password: The password of the user (hashed with Argon2).
- emailVerified: The date and time when the user's email address was verified.
- createdAt: The date of creation.
- **failedLoginAttempts**: Number of consecutive failed login attempts (Security: Account lockout).
- **lockedUntil**: Timestamp when the account lockout expires (Security: Account lockout).
- accounts: A list of linked social media accounts for the user.
- refreshTokens: A list of refresh tokens associated with the user.
- resetToken: A list of reset tokens associated with the user.
- emailVerificationToken: A list of email verification tokens associated with the user.
- userRoles: A list of roles assigned to the user (Security: Permission-based authorization).
- auditLogs: A list of authentication audit log entries for this user.

#### RefreshToken

The RefreshToken entity represents a refresh token used to obtain a new access token. It has the following fields:

- id: A unique identifier for the refresh token.
- token: The token itself (JWT).
- **tokenFamilyId**: The family ID that groups tokens from the same login session (Security: Reuse detection).
- **revoked**: Boolean flag indicating if the token was revoked due to reuse detection (Security: Reuse detection).
- user: The user associated with the refresh token.
- userId: The ID of the user associated with the refresh token.
- createdAt: The date of creation.

#### ResetToken

The ResetToken entity represents a reset token used to reset a user's password. It has the following fields:

- id: A unique identifier for the refresh token.
- token: The token itself.
- expiresAt: The expiration time of the reset token.
- user: The user associated with the reset token.
- userId: The ID of the user associated with the reset token.
- createdAt: The date of creation.

#### EmailVerificationToken

The EmailVerificationToken entity represents a token used to verify a user's email address. It has the following fields:

- id: A unique identifier for the refresh token.
- token: The token itself.
- expiresAt: The expiration time of the email verification token.
- user: The user associated with the email verification token.
- userId: The ID of the user associated with the email verification token.
- createdAt: The date of creation.

#### Permission & Role Models

**Permission**: Represents a specific permission that can be granted to roles (e.g., `USER_READ`, `USER_WRITE`, `ADMIN_PANEL_ACCESS`).

**Role**: Represents a role that can be assigned to users. Roles have multiple permissions.

**RolePermission**: Junction table linking roles to permissions (many-to-many relationship).

**UserRole**: Junction table linking users to roles (many-to-many relationship).

This three-tier system (Users → Roles → Permissions) provides fine-grained access control. Users can have multiple roles, and roles can have multiple permissions.

#### AuthAuditLog

The AuthAuditLog entity represents an audit log entry for authentication events. It has the following fields:

- id: A unique identifier for the audit log entry.
- userId: The ID of the user (nullable for failed login attempts with invalid email).
- user: The user associated with the audit log entry.
- eventType: The type of event (e.g., `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `REFRESH_TOKEN_USED`, `LOGOUT`, `TOKEN_REUSE_DETECTED`, `ACCOUNT_LOCKED`).
- ipAddress: The IP address from which the request originated.
- userAgent: The user agent string from the request.
- createdAt: The timestamp when the event occurred.

This provides a comprehensive audit trail for security monitoring, compliance, and forensic analysis.

<!-- Refresh Token Rotation -->

### Refresh Token Rotation & Reuse Detection

Refresh token rotation is a security practice used to mitigate the risk of unauthorized access to a user's account or resources. When a user logs in to an application, the application issues an access token and a refresh token. The access token is used to access the user's resources, while the refresh token is used to obtain a new access token when the current one expires.

In refresh token rotation, the application rotates the refresh token on each use, meaning it invalidates the old refresh token and issues a new one. This practice limits the amount of time an attacker can use a stolen refresh token.

#### Token Family System

**How it works:**
1. On login, a unique `tokenFamilyId` is generated
2. All refresh tokens from that login session share the same `tokenFamilyId`
3. When a refresh token is used, it's deleted and a new one is created (same family)
4. If a token is reused (stolen token), the system detects it's not in the database
5. All tokens in the compromised family are revoked
6. User is forced to re-authenticate

**Security Benefits:**
- Detects token theft even if the attacker uses the token before the legitimate user
- Prevents replay attacks
- Limits the window of opportunity for attackers
- Provides clear audit trail of token reuse attempts

<!-- Env Variables -->

### Environment Variables

To run this project, you will need to add the following environment variables to your .env file

```
# App's running environment
NODE_ENV=

# App's running port
PORT=

# Server url
SERVER_URL=

# Cors origin url
CORS_ORIGIN=

# Run node -e "console.log(require('crypto').randomBytes(256).toString('base64'));" in your console to generate a secret
ACCESS_TOKEN_SECRET=

REFRESH_TOKEN_SECRET=

ACCESS_TOKEN_EXPIRE=

REFRESH_TOKEN_EXPIRE=

# name of the refresh token cookie
REFRESH_TOKEN_COOKIE_NAME=

MYSQL_DATABASE=
MYSQL_ROOT_PASSWORD=

# Example: mysql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=

# Configuration for the emial service
SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
EMAIL_FROM=
```

See .env.example for further details

<!-- Getting Started -->

## Getting Started

<!-- Prerequisites -->

### Prerequisites

This project uses Yarn as package manager

```bash
 npm install --global yarn
```

<!-- Installation -->

### Installation

```bash
  git clone <your-repository-url> AuthCore-Service
```

Go to the project directory

```bash
  cd AuthCore-Service
```

```bash
  yarn install
```

**Important:** After installation, run database migrations:

```bash
  npx prisma migrate dev
```

This will create the database schema with all security features including token families, account lockout fields, permissions, roles, and audit logging.

### Linting

```bash
  # run ESLint
  yarn lint

  # fix ESLint errors
  yarn lint:fix

  # run prettier
  yarn prettier:check

  # fix prettier errors
  yarn prettier:format

  # fix prettier errors in specific file
  yarn prettier:format:file <file-name>
```

<!-- Running Tests -->

### Running Tests

To run tests, run the following command

```bash
  yarn test
```

Run tests with watch flag

```bash
  yarn test:watch
```

See test coverage

```bash
  yarn coverage
```

<!-- Run Locally -->

### Run Locally

Start the server in development mode

> Note: Dont forget to define the .env variables

```bash
  yarn dev
```

Start the server in production mode

```bash
  yarn start
```

<!-- Run with Docker -->

### Run with Docker

Run docker compose

```bash
  cd AuthCore-Service
  docker-compose up
```

**Note:** After starting Docker, run database migrations:

```bash
  npx prisma migrate deploy
```

<!-- Roadmap -->
## Roadmap

- [ ] Winston + morgan for logging ?
- [ ] Clean and order imports
  - [x] Order imports
  - [ ] Add index.ts files for cleaner imports
- [x] Add xss attack prevention middleware
- [ ] Add API Endpoint documentation
- [ ] Social Auth
  - [ ] Google
  - [ ] Github
  - [ ] Facebook
  - [ ] Twitter
- [ ] Better Error handeling
  - [ ] Custom Error classes like ```AccessTokenNotFoundError```
- [ ] Integration Tests

<!-- Contributing -->
## Contributing

Contributions are always welcome!

See `CONTRIBUTING.md` for ways to get started.

<!-- Code of Conduct -->
### Code of Conduct

Please read the Code of Conduct in `CODE_OF_CONDUCT.md`

<!-- License -->

## License

Distributed under the MIT License. See LICENSE for more information.
