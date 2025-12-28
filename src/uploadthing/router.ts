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
    .onUploadComplete(async ({ file }) => ({ fileUrl: file.url })),
} satisfies FileRouter

export type AppFileRouter = typeof uploadRouter
