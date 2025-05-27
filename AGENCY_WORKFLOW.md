# Agency Workflow Feature

This document describes the Agency Workflow feature that helps organize carousel content for distribution through marketing agencies.

## Overview

The Agency Workflow feature solves the problem of organizing multiple carousel jobs (representing different days of content) into creator-specific folders for easy distribution to marketing agencies. Instead of manually downloading and reorganizing files, this feature automatically restructures your content by creator.

## Key Concepts

- **Jobs**: Each job represents a day's worth of content with multiple variants
- **Variants**: Each variant within a job represents content for a different creator
- **Creator Folders**: The output structure where each creator gets their own folder with subfolders for each day

## How It Works

1. **Job Selection**: Select multiple completed jobs that you want to distribute. All selected jobs must have the same number of variants (creators).

2. **Automatic Reorganization**: The system reorganizes the content from a job-centric structure to a creator-centric structure:
   - Before: Job 1 (Day 1) → Variant 1, 2, 3... (Creators)
   - After: Creator 1 → Day 1, 2, 3... (Jobs)

3. **Export Options**: Choose between local ZIP downloads or Google Drive export with organized folder structure.

## Usage

### Accessing the Feature

The Agency Workflow can be accessed from two locations:
- **Jobs Page**: Click the "Agency Export" button in the header
- **Assets Page**: Click the "Agency Export" button in the header

### Step-by-Step Process

1. **Open Agency Workflow Modal**
   - Click the "Agency Export" button
   - The modal will load all your completed jobs

2. **Select Jobs**
   - Check the jobs you want to include (each represents a day of content)
   - Use "Select All" for convenience
   - Ensure all selected jobs have the same number of variants

3. **Configure Export Options**

   **Creator Naming**:
   - Default: "Creator 1", "Creator 2", etc.
   - Custom: Enter specific names for each creator

   **Day Labeling**:
   - Day Numbers: "Day 1", "Day 2", etc.
   - Weekdays: "Monday", "Tuesday", etc.
   - Custom: Enter specific labels for each day

   **Export Type**:
   - Local Download: Creates one ZIP file per creator
   - Google Drive: Creates organized folder structure in your Drive

4. **Export**
   - Click "Export" to start the process
   - Monitor progress in the modal
   - Files will be downloaded or uploaded based on your selection

## Output Structure

### Local Download (ZIP Files)
```
Creator_1_content.zip
├── Day 1/
│   ├── JobName_image1.jpg
│   ├── JobName_image2.jpg
│   └── ...
├── Day 2/
│   └── ...
└── Day 3/
    └── ...

Creator_2_content.zip
├── Day 1/
│   └── ...
└── ...
```

### Google Drive Export
```
Agency Content Export - [Date]/
├── Creator 1/
│   ├── Day 1/
│   │   ├── JobName_image1.jpg
│   │   └── ...
│   ├── Day 2/
│   │   └── ...
│   └── Day 3/
│       └── ...
├── Creator 2/
│   └── ...
└── Creator 3/
    └── ...
```

## Example Scenario

You're working with an agency that has hired 10 content creators for a 5-day campaign:

1. Generate 5 carousel jobs (one for each day) with 10 variants each
2. Open Agency Workflow and select all 5 jobs
3. Optionally set custom creator names (e.g., actual creator usernames)
4. Set day labeling to "weekday" for Monday-Friday
5. Export to Google Drive for easy sharing

Result: 10 creator folders, each containing 5 day folders with their respective carousel images.

## Best Practices

1. **Consistent Variants**: Always generate the same number of variants across jobs that will be distributed together
2. **Naming Convention**: Use descriptive job names that indicate the content theme or date
3. **Batch Processing**: Process all jobs for a campaign at once to ensure consistency
4. **Google Drive Organization**: Create a dedicated folder in Google Drive for each campaign

## Troubleshooting

### "All selected jobs must have the same number of variants"
- This error occurs when you select jobs with different variant counts
- Solution: Only select jobs that were created with the same number of variants

### Google Drive Authentication
- If not authenticated, you'll be redirected to Google sign-in
- After authentication, return to the modal and try again

### Download Issues
- Browser may block multiple downloads - allow popups from the site
- Downloads are spaced 500ms apart to prevent blocking

## Technical Details

- **Service**: `AgencyWorkflowService` handles the reorganization logic
- **Component**: `AgencyWorkflowModal` provides the UI
- **Integration**: Works with existing `GoogleDriveService` for cloud exports
- **Database**: Reads from `generated_carousel_images` table to fetch variants 