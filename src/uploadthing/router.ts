import { createUploadthing, type FileRouter } from 'uploadthing/server'

const f = createUploadthing()

export const uploadRouter = {
  accommodationIdProof: f({
    image: { maxFileSize: '4MB' },
    pdf: { maxFileSize: '8MB' },
  })
    .middleware(() => ({
      userId: null,
    }))
    .onUploadComplete(async ({ file }) => ({ fileUrl: file.ufsUrl })),
  
  pdfUploader: f({
    pdf: { maxFileSize: '128MB', maxFileCount: 1 }
  })
    .middleware(() => ({
      userId: null,
    }))
    .onUploadComplete(async ({ file }) => ({ fileUrl: file.ufsUrl })),
} satisfies FileRouter

export type AppFileRouter = typeof uploadRouter
