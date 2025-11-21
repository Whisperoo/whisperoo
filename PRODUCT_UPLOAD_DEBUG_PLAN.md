# Product Upload & File Visualization Issues - Debug Plan

## Problem Statement

Product uploading and file visualization is not working correctly when uploading files with two videos and two PDFs. The product does not show up correctly in the application after upload.

## Current Issues Identified

### 1. Product Not Displaying After Upload
- **Issue**: Products with multiple file types (2 videos + 2 PDFs) are not appearing correctly
- **Symptoms**: Product missing from UI or displaying incorrectly
- **Impact**: Users cannot see their uploaded products

### 2. File Visualization Problems  
- **Issue**: Files (videos and PDFs) not rendering properly
- **Symptoms**: Files not showing previews, thumbnails, or proper file type indicators
- **Impact**: Poor user experience when reviewing uploaded content

## Step-by-Step Debugging Plan

### Phase 1: Database Investigation (Supabase)

#### 1.1 Check Product Table Structure
- [ ] Verify product table schema matches expected structure
- [ ] Check for any missing columns or constraints
- [ ] Validate data types for file-related fields

#### 1.2 Verify File Storage Configuration
- [ ] Check Supabase Storage bucket configuration
- [ ] Verify file upload policies and permissions
- [ ] Test storage bucket accessibility

#### 1.3 Investigate Upload Records
- [ ] Query products table for recent uploads
- [ ] Check if products are being created in database
- [ ] Verify file paths and metadata are stored correctly
- [ ] Look for any error logs in Supabase

#### 1.4 File Reference Integrity
- [ ] Check if uploaded files exist in storage
- [ ] Verify file URLs are accessible
- [ ] Test file permissions and public access

### Phase 2: Frontend Investigation

#### 2.1 Upload Component Analysis
- [ ] Review product upload form component
- [ ] Check file handling logic for multiple file types
- [ ] Verify form validation for mixed file uploads
- [ ] Test file preview generation

#### 2.2 API Integration Review
- [ ] Check API calls during upload process
- [ ] Verify request/response format matches backend expectations
- [ ] Test error handling for failed uploads
- [ ] Review authentication/authorization

#### 2.3 State Management Issues
- [ ] Check if product state updates after upload
- [ ] Verify local state synchronization with database
- [ ] Test component re-rendering after upload
- [ ] Review any caching issues

#### 2.4 File Display Components
- [ ] Test video file rendering components
- [ ] Test PDF file rendering components
- [ ] Check file type detection logic
- [ ] Verify thumbnail generation

### Phase 3: Integration Testing

#### 3.1 End-to-End Upload Flow
- [ ] Test complete upload process with browser dev tools
- [ ] Monitor network requests during upload
- [ ] Check console for JavaScript errors
- [ ] Verify file processing pipeline

#### 3.2 Cross-Component Communication
- [ ] Test data flow between upload and display components
- [ ] Verify event handling and callbacks
- [ ] Check props passing and component updates

#### 3.3 Error Scenarios
- [ ] Test with large file sizes
- [ ] Test with unsupported file types
- [ ] Test with network interruptions
- [ ] Test concurrent uploads

### Phase 4: Performance & Optimization

#### 4.1 File Processing Performance
- [ ] Check upload speed for multiple files
- [ ] Monitor memory usage during uploads
- [ ] Test concurrent file processing

#### 4.2 UI Responsiveness
- [ ] Test loading states during upload
- [ ] Verify progress indicators
- [ ] Check for UI blocking during processing

## Expected Fixes

### Database Level
1. **Schema Updates**: Ensure proper table structure for multi-file products
2. **Storage Policies**: Update RLS policies for file access
3. **Indexing**: Add proper indexes for file queries

### Frontend Level
1. **Upload Handler**: Fix multi-file upload processing
2. **State Updates**: Ensure proper state refresh after uploads
3. **File Rendering**: Fix video and PDF display components
4. **Error Handling**: Add comprehensive error handling

### Integration Level  
1. **API Consistency**: Ensure frontend and backend data formats match
2. **Real-time Updates**: Implement proper data synchronization
3. **File URLs**: Fix file path generation and access

## Testing Strategy

### Unit Tests
- [ ] Test individual upload components
- [ ] Test file validation functions  
- [ ] Test API service methods

### Integration Tests
- [ ] Test complete upload workflow
- [ ] Test file display after upload
- [ ] Test error scenarios

### Manual Testing
- [ ] Test with exact scenario: 2 videos + 2 PDFs
- [ ] Test with different file combinations
- [ ] Test on different browsers/devices

## Success Criteria

1. **Upload Success**: Products with 2 videos + 2 PDFs upload successfully
2. **Database Persistence**: All files and metadata stored correctly in Supabase
3. **UI Display**: Products appear correctly in application interface
4. **File Visualization**: All files (videos/PDFs) render properly with previews
5. **Performance**: Upload process completes in reasonable time
6. **Error Handling**: Clear error messages for any failures

## Risk Areas to Focus On

1. **File Size Limits**: Both client-side and server-side limits
2. **Storage Quotas**: Supabase storage bucket limits
3. **Concurrent Processing**: Multiple files uploading simultaneously  
4. **Memory Leaks**: Large file handling in browser
5. **Authentication**: File access permissions and user context

## Tools for Investigation

- **Browser DevTools**: Network tab, Console, Application storage
- **Supabase Dashboard**: Database queries, Storage browser, Logs
- **React DevTools**: Component state and props inspection
- **Network Monitoring**: Request/response analysis
- **Performance Profiler**: Upload performance metrics

---

## Next Steps

1. Start with Phase 1 (Database Investigation) to understand data layer issues
2. Move to Phase 2 (Frontend Investigation) to identify UI/logic problems  
3. Proceed to Phase 3 (Integration Testing) for end-to-end validation
4. Complete with Phase 4 (Performance & Optimization) for final polish

This systematic approach will ensure we identify and fix all issues preventing proper product upload and file visualization functionality.