# Pokedex Scanner - Document Scanning App

A React-based document scanning application that allows users to capture, edit, and store documents with manual cropping capabilities. Think of it like a Pokedex for documents - just as a Pokemon trainer scans and catalogs new Pokemon they encounter, this app lets you scan and organize your documents.

## Why "Pokedex"?

As a Pokemon fan, when I read the project requirements about scanning and cataloging documents, the first thing that came to mind was how a Pokemon trainer uses their Pokedex to scan and store information about new Pokemon they discover. The parallel felt perfect - both involve scanning, capturing, and organizing items in a digital collection.

## Architecture Overview

### Data Flow
1. **Upload** - Users drop files or capture images through the upload interface
2. **Processing** - Images are loaded onto HTML5 Canvas for manipulation
3. **Editing** - Users can rotate, filter, zoom, and manually crop images
4. **Storage** - Processed documents are saved to Firebase Storage
5. **Metadata** - Document information is stored in Firestore with user isolation
6. **Gallery** - Users can view, download, and delete their saved documents



### Data Storage Pattern
Documents are stored using Firebase's user isolation pattern:
```
/users/{userId}/scans/{scanId}
```
This ensures each user only sees their own documents.

## How Auto-Crop Works (The Idea)

**Note: Auto-crop functionality was attempted but didn't work reliably enough for production.**

The intended algorithm was:
1. **Edge Detection** - Apply Gaussian blur then Sobel edge detection to find document edges
2. **Contour Finding** - Trace the edges to find closed contours that might represent document boundaries
3. **Corner Detection** - Identify the four corners of the largest rectangular contour
4. **Perspective Correction** - Apply perspective transformation to create a flat, rectangular document

The implementation attempted to use:
- OpenCV.js for computer vision operations
- Pure JavaScript fallback with custom edge detection algorithms
- Canvas-based image processing for contrast and brightness enhancement

**Why it didn't work:** I believe that Computer vision in browsers is complex, and the OpenCV.js library created import/export conflicts. 

## Setup Instructions

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn package manager
- Firebase account for backend services

### Environment Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Firebase project and enable:
   - Authentication (Email/Password)
   - Firestore Database
   - Storage

4. Create `.env` file with your Firebase config:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```

### Available Scripts
- `npm start` - Development server (http://localhost:3000)
- `npm run build` - Production build
- `npm test` - Run tests
- `npm run deploy` - Build and deploy to Firebase
- `npm run deploy:hosting` - Deploy only the web app
- `npm run deploy:rules` - Deploy only database rules

## Libraries Used

### Core Framework
- **React 18.2.0** - UI framework (MIT License)
- **React Router DOM 6.20.0** - Client-side routing (MIT License)
- **Styled Components 6.1.0** - CSS-in-JS styling (MIT License)

### Firebase Integration
- **Firebase 10.7.0** - Backend services (Apache 2.0 License)
  - Authentication for user management
  - Firestore for document metadata
  - Storage for document files

### Image Processing
- **React Image Crop 10.1.8** - Manual cropping interface (ISC License)
- **Konva 9.2.3** & **React Konva 18.2.10** - Canvas manipulation (MIT License)
- **OpenCV.js 1.2.1** - Computer vision (attempted, BSD License)

### Utilities
- **React Dropzone 14.2.3** - File upload interface (MIT License)
- **PDF-lib 1.17.1** - PDF generation (MIT License)
- **File-saver 2.0.5** - File download functionality (MIT License)
- **UUID 9.0.1** - Unique ID generation (MIT License)

All libraries use OSS-compatible licenses (MIT, Apache 2.0, ISC, BSD).

## Current Features

### Working Features
- **User Authentication** - Secure login/logout with Firebase Auth
- **Document Upload** - Drag-and-drop or click to upload images
- **Manual Image Editing** - Rotate, zoom, apply filters (grayscale, enhanced contrast)
- **Manual Cropping** - Both rectangular (box) and free-form drawing crop modes
- **Document Gallery** - View all saved documents with thumbnails
- **Download/Delete** - Export documents or remove them from storage
- **User Isolation** - Each user only sees their own documents

### Attempted Features (Didn't Work)
- **Auto-Crop** - Automatic document detection and cropping
- **Compare View** - Before/after comparison (removed due to conflicts)
- **Advanced Filters** - More sophisticated image enhancement

## Trade-offs & What I'd Improve Next

### Trade-offs Made
1. Chose manual cropping over unreliable auto-crop
2. Avoided heavy computer vision libraries that caused conflicts
3. Removed problematic features rather than ship buggy functionality
4. Used Canvas API instead of more powerful but heavier image processing libraries

### Next Improvements
1. Research server-side document detection or more reliable browser-based solutions
2. Better touch interfaces and camera integration
3. Upload and process multiple documents at once
4. Perspective correction, noise reduction, text enhancement
5. Multiple formats (PNG, JPEG, PDF) with quality settings

### Technical Debt
- Manual cropping coordinate conversion could be more robust
- Image processing operations could be moved to Web Workers for better performance
- Error handling could be more comprehensive with user-friendly messages
- Test coverage needs to be added

## Development Notes

The app successfully demonstrates core document scanning functionality with a clean, intuitive interface. While some advanced features like auto-crop didn't make it to production, the manual tools provide full control over document processing. The Firebase integration ensures secure, scalable document storage with real-time updates.

The Pokemon theme adds a fun, engaging element to what could otherwise be a dry productivity app, making document scanning feel more like collecting and organizing a digital collection.


