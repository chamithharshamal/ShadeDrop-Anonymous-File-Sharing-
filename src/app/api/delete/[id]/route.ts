import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabaseClient'
import bcrypt from 'bcryptjs'

// DELETE /api/delete/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Check if Supabase is configured
  if (!supabaseService) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  try {
    // Get the actual params value
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ error: 'Missing file ID' }, { status: 400 })
    }
    
    // Get file information using service role client
    const { data: file, error: fileError } = await supabaseService
      .from('files')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // Check password if the file is protected
    if (file.password_hash) {
      try {
        const body = await request.json()
        const { password } = body
        
        if (!password) {
          return NextResponse.json({ error: 'Password required' }, { status: 401 })
        }
        
        const isValidPassword = await bcrypt.compare(password, file.password_hash)
        if (!isValidPassword) {
          return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
        }
      } catch (e) {
        return NextResponse.json({ error: 'Password required' }, { status: 401 })
      }
    }
    
    // Delete from storage using service role client
    const { error: storageError } = await supabaseService.storage
      .from('ghostshare')
      .remove([file.storage_path])
    
    if (storageError) {
      console.error('Storage deletion error:', storageError)
      return NextResponse.json({ error: 'Failed to delete file from storage' }, { status: 500 })
    }
    
    // Delete from database using service role client
    const { error: dbError } = await supabaseService
      .from('files')
      .delete()
      .eq('id', id)
    
    if (dbError) {
      console.error('Database deletion error:', dbError)
      return NextResponse.json({ error: 'Failed to delete file record' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'File deleted successfully' })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}