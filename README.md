# Employee Attendance and Scheduling System

A full-stack web application built with Next.js, TypeScript, Tailwind CSS, and Prisma for managing employee attendance and weekly schedules.

## Features

- User authentication with email and password
- Clock in/out functionality for attendance tracking
- Weekly schedule management for employees
- Dashboard with current status and schedule overview

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3001](http://localhost:3001) in your browser.

## Usage

- Login with email: employee@example.com, password: password
- Clock in/out using the buttons on the dashboard
- Update your weekly schedule by filling the form and submitting

## Technologies Used

- Next.js 16
- TypeScript
- Tailwind CSS
- Prisma with SQLite
- NextAuth.js
- bcryptjs
