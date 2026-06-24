// UploadForm.tsx
// ─────────────────────────────────────────────────────────────
// The main form on the home page. Handles:
//   - Drag and drop OR click-to-browse PDF upload
//   - Job description text input
//   - Calling the backend API
//   - Passing results back up to the parent page
//
// NOTE: We use the browser's native HTML5 drag-and-drop API and a
// standard <input type="file"> instead of react-dropzone. The project
// runs Next.js 16 + React 19, and react-dropzone@15 does not declare
// React 19 support, which caused the drop zone to render but not respond.
// ─────────────────────────────────────────────────────────────

'use client';

// useState is React's way of storing values that change over time.
// useRef lets us reference the hidden file input so we can open the
// file dialog when the user clicks the drop zone.
import { useState, useRef } from 'react';

// Lucide gives us clean SVG icons as React components
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';

import { analyzeResume } from '../lib/api';
import { AnalysisResult, FormStatus } from '../lib/types';

// ── PROPS ─────────────────────────────────────────────────────
interface UploadFormProps {
  // Callback: when analysis completes, pass result to parent page
  onSuccess: (result: AnalysisResult) => void;
}

export default function UploadForm({ onSuccess }: UploadFormProps) {

  // ── STATE ──────────────────────────────────────────────────
  // useState<Type>(initialValue) creates a state variable.
  // [value, setValue] — value is read, setValue updates it.

  // The PDF file the user selected (null if none yet)
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // The job description text the user typed
  const [jobDescription, setJobDescription] = useState('');

  // Current status of the form
  const [status, setStatus] = useState<FormStatus>('idle');

  // Error message to show if something goes wrong
  const [errorMessage, setErrorMessage] = useState('');

  // True while the user is dragging a file over the drop zone
  const [isDragging, setIsDragging] = useState(false);

  // Reference to the hidden file input. We trigger it programmatically
  // when the user clicks the drop zone.
  const inputRef = useRef<HTMLInputElement>(null);


  // ── FILE HANDLING ──────────────────────────────────────────
  // Opens the browser's file picker when the drop zone is clicked.
  const handleClick = () => {
    inputRef.current?.click();
  };

  // Called when the user selects a file through the file picker.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      setErrorMessage('');
    }
    // Reset the input so the same file can be selected again if needed.
    e.target.value = '';
  };

  // Called continuously while a file is dragged over the drop zone.
  // preventDefault() is required for drop to work.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Called when the dragged file leaves the drop zone.
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Called when the user drops a file onto the drop zone.
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMessage('Only PDF files are accepted.');
      return;
    }

    setResumeFile(file);
    setErrorMessage('');
  };


  // ── SUBMIT HANDLER ─────────────────────────────────────────
  const handleSubmit = async () => {

    // Guard clauses — stop early if inputs are invalid
    if (!resumeFile) {
      setErrorMessage('Please upload your resume PDF.');
      return;
    }
    if (jobDescription.trim().length < 50) {
      setErrorMessage('Job description must be at least 50 characters.');
      return;
    }

    // Switch to loading state — disables the button and shows spinner
    setStatus('loading');
    setErrorMessage('');

    try {
      // Call our api.ts function — this talks to NestJS
      const result = await analyzeResume(resumeFile, jobDescription);

      // Success — tell the parent page about the result
      setStatus('success');
      onSuccess(result);

    } catch (error) {
      // Something went wrong — show the error message
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.'
      );
    }
  };


  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── PDF DROP ZONE ─────────────────────────────────── */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl
          p-10 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            // Blue highlight when user is dragging a file over it
            ? 'border-indigo-400 bg-indigo-50'
            : resumeFile
            // Green when a file has been selected
            ? 'border-green-400 bg-green-50'
            // Default gray
            : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50'
          }
        `}
      >
        {/* Hidden file input. The user never sees it; we open it via click(). */}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          {resumeFile ? (
            <>
              {/* Show file icon + name when file is selected */}
              <FileText className="w-10 h-10 text-green-500" />
              <p className="font-semibold text-green-700">
                {resumeFile.name}
              </p>
              <p className="text-sm text-gray-500">
                Click or drop to replace
              </p>
            </>
          ) : (
            <>
              {/* Default state — show upload prompt */}
              <Upload className="w-10 h-10 text-gray-400" />
              <p className="font-semibold text-gray-700">
                {isDragging
                  ? 'Drop your resume here...'
                  : 'Drag & drop your resume PDF'}
              </p>
              <p className="text-sm text-gray-500">
                or click to browse files
              </p>
            </>
          )}
        </div>
      </div>


      {/* ── JOB DESCRIPTION INPUT ─────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Job Description
        </label>
        <textarea
          value={jobDescription}
          // Every keystroke updates the jobDescription state
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here..."
          rows={8}
          className="
            w-full rounded-xl border border-gray-200
            p-4 text-sm text-gray-700
            focus:outline-none focus:ring-2 focus:ring-indigo-300
            resize-none
          "
        />
        {/* Character count — helps user know if they've typed enough */}
        <p className="text-xs text-gray-400 text-right">
          {jobDescription.length} characters
          {jobDescription.length < 50 && ' (minimum 50)'}
        </p>
      </div>


      {/* ── ERROR MESSAGE ─────────────────────────────────── */}
      {errorMessage && (
        <div className="
          flex items-start gap-3
          p-4 rounded-xl
          bg-red-50 border border-red-200
          text-red-700 text-sm
        ">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}


      {/* ── SUBMIT BUTTON ─────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        // Disable while loading so user can't double-submit
        disabled={status === 'loading'}
        className="
          w-full py-4 rounded-xl
          bg-indigo-600 hover:bg-indigo-700
          text-white font-semibold text-base
          transition-colors duration-200
          disabled:opacity-60 disabled:cursor-not-allowed
          flex items-center justify-center gap-3
        "
      >
        {status === 'loading' ? (
          <>
            {/* Spinner icon while waiting for AI response */}
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyzing... (this may take 30–90 seconds)
          </>
        ) : (
          'Analyze Match'
        )}
      </button>
    </div>
  );
}
