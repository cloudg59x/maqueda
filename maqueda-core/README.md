# Secure Admin Panel

A secure admin panel built with Next.js, Prisma, and PostgreSQL featuring:

- Secure authentication with JWT sessions
- Role-based access control
- Server actions for data management
- Rate limiting and input validation
- Responsive UI with shadcn/ui components

## Features

- **Secure Authentication**: Password hashing with bcrypt, JWT sessions, and rate limiting
- **Role-Based Access**: Different permission levels (USER, ADMIN)
- **Server Actions**: Secure data management through server-side actions
- **Responsive Design**: Mobile-friendly admin interface
- **Security Best Practices**: Input sanitization, rate limiting, and XSS prevention

## Tech Stack

- **Frontend**: Next.js 13+ with App Router, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui with Radix UI
- **Backend**: Server Actions, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: JWT, bcryptjs
- **Security**: rate-limiter-flexible, input validation

## Running with Docker (Recommended)

1. Start the application and database:
   ```bash
   docker-compose up -d
   ```

2. Run database migrations (first time only):
   ```bash
   docker-compose exec admin-panel npm run setup-db
   ```

3. Access the application at http://localhost:3000

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   # .env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/adminpanel?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   ```

3. Start PostgreSQL database (using Docker):
   ```bash
   docker-compose up -d postgres
   ```

4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Test Credentials

- **Email**: admin@example.com
- **Password**: AdminPass123!

## Security Features

- Password hashing with bcrypt
- JWT-based session management
- Rate limiting for authentication attempts
- Input validation and sanitization
- Role-based access control
- Protected routes middleware
- Secure cookie settings (httpOnly, sameSite, secure)

## Folder Structure

```
src/
├── app/              # Next.js app router pages
│   ├── admin/        # Admin panel pages
│   ├── api/          # API routes
│   └── auth/         # Authentication pages
├── components/       # React components
│   ├── admin/       # Admin-specific components
│   └── ui/          # Reusable UI components
├── lib/             # Utility functions
└── actions/         # Server actions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run setup-db` - Run database migrations