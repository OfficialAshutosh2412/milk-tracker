# Milk Tracker App

A Next.js application designed to track your daily milk deliveries, extra grocery items, and manage monthly expenses.

## Deploying to Vercel (Production)

This app is production-ready and optimized for serverless deployment on Vercel.

### Prerequisites
1. A GitHub, GitLab, or Bitbucket account.
2. A Vercel account.
3. A Neon (PostgreSQL) account.

### Step 1: Set up Neon PostgreSQL Database

1. Sign in to [Neon](https://neon.tech/) and create a new project.
2. Go to your project dashboard and copy the **Connection String** from the "Connection Details" section. It looks something like: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`
3. We need two strings for Prisma: the standard connection URL and a Direct URL. Often with Neon, the same connection string works for both `DATABASE_URL` and `DIRECT_URL`.

### Step 2: Set up GitHub Repository

1. Initialize a Git repository in your local project folder (if not done already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Vercel deployment"
   ```
2. Create a new repository on GitHub and push your code:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

### Step 3: Deploy to Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New... > Project**.
2. Import the Git repository you just created.
3. In the **Configure Project** section, open the **Environment Variables** section.
4. Add the following two environment variables:
   - `DATABASE_URL` : Paste your Neon connection string here.
   - `DIRECT_URL` : Paste your Neon connection string here again.
5. Click **Deploy**. Vercel will automatically install dependencies, run `prisma generate`, and build your Next.js application.

### Step 4: Initialize the Database Schema

Once Vercel has built your app, the database tables need to be created. You can do this by running a command locally or configuring a migration.

Since you are using `prisma db push` locally, you can push the schema from your local machine directly to Neon:
1. Update your local `.env` file with the Neon connection strings.
2. Run `npx prisma db push` locally.
3. This creates all necessary tables in your Neon production database.
(Alternatively, add `"postinstall": "prisma generate && prisma db push"` to your `package.json` for automatic push during Vercel builds, though migrating manually is safer for production.)

## Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your PostgreSQL credentials to `.env`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Push your schema to the database:
   ```bash
   npx prisma db push
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Login System

The application has a built-in admin login system to protect your data operations. The default credentials (defined in `src/app/actions.ts`) are:
- **Email**: `ashutoshprasad2427@gmail.com`
- **Password**: `@Sannu123`
