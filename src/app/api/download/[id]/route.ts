import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabaseClient'
import bcrypt from 'bcryptjs'

// GET /api/download/[id]?password=...
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Check if Supabase is configured
  if (!supabaseService) {
    console.error('Supabase not configured')
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  try {
    // Get the actual params value
    const { id } = await params
    
    console.log('Download request for file ID:', id)
    
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')
    
    // Check if this is a HEAD request (password verification only)
    const isHeadRequest = request.method === 'HEAD'
    
    if (!id) {
      console.error('Missing file ID')
      return NextResponse.json({ error: 'Missing file ID' }, { status: 400 })
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      console.error('Invalid UUID format:', id)
      return NextResponse.json({ error: 'Invalid file ID format' }, { status: 400 })
    }
    
    // Get file information using service role client
    const { data: files, error: fileError } = await supabaseService
      .from('files')
      .select('*')
      .eq('id', id)
    
    if (fileError) {
      console.error('Database query error:', fileError)
      return NextResponse.json({ error: 'Database query failed', details: fileError.message }, { status: 500 })
    }
    
    // Check if file exists
    if (!files || files.length === 0) {
      console.error('File not found in database for ID:', id)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // Check if we got more than one file (shouldn't happen with UUIDs)
    if (files.length > 1) {
      console.error('Multiple files found for ID:', id)
      return NextResponse.json({ error: 'Multiple files found' }, { status: 500 })
    }
    
    const file = files[0]
    console.log('File found:', file.filename)
    
    // Check if file has expired
    const now = new Date()
    const expiresAt = new Date(file.expires_at)
    if (now > expiresAt) {
      console.error('File has expired')
      return NextResponse.json({ error: 'File has expired' }, { status: 400 })
    }
    
    // Check if file has already been sent (for one-time downloads)
    if (file.one_time && file.sent) {
      console.error('File has already been downloaded (one-time)')
      return NextResponse.json({ error: 'File has already been downloaded' }, { status: 400 })
    }
    
    // Verify password if required
    if (file.password_hash) {
      if (!password) {
        console.error('Password required but not provided')
        return NextResponse.json({ error: 'Password required' }, { status: 401 })
      }
      
      // Compare with stored hash
      const isValidPassword = await bcrypt.compare(password, file.password_hash)
      
      if (!isValidPassword) {
        console.error('Invalid password provided')
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
      }
      
      // If this is just a HEAD request for password verification, return success
      if (isHeadRequest) {
        return new NextResponse(null, { status: 200 })
      }
    } else if (isHeadRequest) {
      // If no password is required and this is a HEAD request, return success
      return new NextResponse(null, { status: 200 })
    }
    
    // Generate signed download URL using service role client
    console.log('Generating signed URL for:', file.storage_path)
    
    // For delete_after_send files, we need to stream the file through our server
    // to ensure we can delete it after download
    if (file.delete_after_send) {
      try {
        // Download the file content
        const { data: fileData, error: fileError } = await supabaseService.storage
          .from('ghostshare')
          .download(file.storage_path)
        
        if (fileError) {
          console.error('File download error:', fileError)
          return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
        }
        
        // Convert Blob to Buffer
        const arrayBuffer = await fileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Create response with file content
        const response = new NextResponse(buffer)
        response.headers.set('Content-Type', file.mime_type)
        response.headers.set('Content-Disposition', `attachment; filename="${file.filename}"`)
        
        // Delete file after sending response
        try {
          // Delete from storage using service role client
          const { error: storageError } = await supabaseService.storage
            .from('ghostshare')
            .remove([file.storage_path])
          
          if (storageError) {
            console.error('Storage deletion error:', storageError)
          }
          
          // Delete from database using service role client
          const { error: dbError } = await supabaseService
            .from('files')
            .delete()
            .eq('id', id)
          
          if (dbError) {
            console.error('Database deletion error:', dbError)
          }
          
          console.log('File deleted after download')
        } catch (deleteError) {
          console.error('Deletion error:', deleteError)
        }
        
        return response
      } catch (streamError) {
        console.error('Stream error:', streamError)
        return NextResponse.json({ error: 'Failed to stream file' }, { status: 500 })
      }
    }
    
    // For regular files, use signed URL
    const { data: urlData, error: urlError } = await supabaseService.storage
      .from('ghostshare')
      .createSignedUrl(file.storage_path, 3600, { // 1 hour expiry
        download: file.filename
      })
    
    if (urlError) {
      console.error('URL generation error:', urlError)
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
    }
    
    console.log('Signed URL generated successfully')
    
    // Update sent status for one-time files using service role client
    if (file.one_time) {
      const { error: updateError } = await supabaseService
        .from('files')
        .update({ sent: true })
        .eq('id', id)
      
      if (updateError) {
        console.error('Update error:', updateError)
      } else {
        console.log('File sent status updated')
      }
    }
    
    // Redirect to the signed URL
    console.log('Redirecting to signed URL')
    return NextResponse.redirect(urlData.signedUrl)
  } catch (error: any) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}