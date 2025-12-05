# ShadeDrop

A modern, privacy-friendly anonymous file sharing web application built with Next.js 15, Supabase, and Tailwind CSS.

<img width="1630" height="876" alt="Screenshot 2025-12-05 130114" src="https://github.com/user-attachments/assets/9a0a8451-6d82-472e-a52f-1ae0b440d9d2" />
## Features


- 📁 **Anonymous File Uploads**: Share files without creating an account
- 🔐 **Password Protection**: Optional password protection for shared files
- ⏰ **Custom Expiration**: Choose from 1 hour, 2 hours, 24 hours, or 7 days
- 🧼 **Self-Destructing Links**: Option to delete files after first download
- 📧 **Email Sharing**: Send download links directly via email
- 📱 **QR Code Generation**: Generate QR codes for easy mobile access
- 👁️ **File Previews**: Preview supported file types before downloading
- 🌙 **Dark Mode UI**: Modern "privacy vault" aesthetic with dark theme
- 🛡️ **Secure Storage**: Files stored securely in Supabase Storage

## Technical Stack

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Email**: Mailjet SMTP
- **Deployment**: Vercel

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Mailjet Configuration
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_API_SECRET=your_mailjet_api_secret
MAILJET_FROM_EMAIL=your_verified_sender_email@example.com

# Application Settings
NEXT_PUBLIC_MAX_FILE_SIZE=104857600
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Authentication (for cleanup jobs)
CRON_AUTH_TOKEN=your_secure_cron_auth_token
```

### 2. Supabase Setup

1. Create a new Supabase project
2. Run the SQL script in `supabase/setup.sql` in your Supabase SQL editor:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of `supabase/setup.sql`
   - Run the script

This will create:
- The `files` table with all necessary columns
- Indexes for better query performance
- Row Level Security policies

3. Set up Storage Bucket and Policies:
   - Go to Storage > Buckets in your Supabase dashboard
   - Create a new bucket named `ghostshare`
   - Set it as private (not public)
   - Follow the instructions in `supabase/STORAGE_SETUP.md` to set up the required policies

4. **Verify your setup** by running the test script:
   ```bash
   npm run test:supabase
   ```

### 3. Mailjet Setup

1. Create a Mailjet account
2. Verify your sender email address
3. Get your API key and secret

### 4. Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### 5. Vercel Deployment

For detailed instructions on deploying to Vercel, please refer to the [Vercel Deployment Guide](VERCEL_DEPLOYMENT_GUIDE.md).

Key points for Vercel deployment:

1. **Environment Variables**: All environment variables must be set in the Vercel dashboard, not in `.env.local`
2. **NEXT_PUBLIC_APP_URL**: Update this to your actual Vercel deployment URL
3. **Health Check**: Use the `/api/health` endpoint to verify your deployment is working correctly

### 6. Deployment

Deploy to Vercel:

1. Push your code to a GitHub repository
2. Connect the repository to Vercel
3. Set all required environment variables in the Vercel dashboard (see [Vercel Deployment Guide](VERCEL_DEPLOYMENT_GUIDE.md))
4. Deploy!

### 7. Cleanup Cron Job

Set up a cron job to clean up expired files daily:

**Vercel Cron**:
Add to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cleanup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## Database Schema

```sql
-- Files table
CREATE TABLE files (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  delete_after_send BOOLEAN DEFAULT false,
  one_time BOOLEAN DEFAULT false,
  sent BOOLEAN DEFAULT false,
  email TEXT,
  password_hash TEXT
);
```

## API Endpoints

- `POST /api/request-upload` - Request a signed upload URL
- `POST /api/send-link` - Send download link via email
- `GET /api/download/[id]` - Download a file (with password verification)
- `DELETE /api/delete/[id]` - Delete a file
- `GET /api/health` - Health check endpoint
- `POST /api/cleanup` - Clean up expired files (cron job)

## Security Features

- Files stored in private Supabase Storage bucket
- Signed URLs for secure upload/download
- Password hashing with SHA-256
- Automatic cleanup of expired files
- One-time download option
- Self-destructing links

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
