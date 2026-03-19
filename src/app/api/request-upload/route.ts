import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'

// POST /api/request-upload
export async function POST(request: Request) {
  // Check if Supabase is configured
  if (!supabaseService) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  try {
    const { filename, mimeType, size, expiresIn, deleteAfterSend, oneTime, email, password } = await request.json()
    
    // Validate file size
    const maxSize = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '104857600') // 100MB default
    if (size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds maximum allowed' }, { status: 400 })
    }
    
    // Generate a unique file ID
    const fileId = uuidv4()
    
    // Calculate expiration time
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + expiresIn * 60 * 60 * 1000)
    
    // Hash password if provided
    let passwordHash = null
    if (password) {
      passwordHash = await bcrypt.hash(password, 10)
    }
    
    // Save file metadata to database using service role client
    const { data, error } = await supabaseService
      .from('files')
      .insert({
        id: fileId,
        filename,
        mime_type: mimeType,
        size,
        storage_path: `uploads/${fileId}/${filename}`,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        delete_after_send: deleteAfterSend, // Now represents "delete after one download"
        one_time: deleteAfterSend, // Same as delete_after_send for "delete after one download"
        sent: false,
        email,
        password_hash: passwordHash
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to save file metadata' }, { status: 500 })
    }
    
    // Generate signed upload URL using service role client
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('ghostshare')
      .createSignedUploadUrl(`uploads/${fileId}/${filename}`)
    
    if (uploadError) {
      console.error('Upload URL error:', uploadError)
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    }
    
    return NextResponse.json({
      fileId: data.id,
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token
    })
  } catch (error) {
    console.error('Upload request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}