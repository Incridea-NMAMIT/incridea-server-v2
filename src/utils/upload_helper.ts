import { UTApi } from 'uploadthing/server'
import path from 'path'
import fs from 'fs'
import { File } from 'buffer'

import { config } from 'dotenv'
config()

async function main() {
    const filenameOrPath = process.argv[2]
    
    if (!filenameOrPath) {
        console.error('Error: No file path/name provided')
        process.exit(1)
    }
    
    if (!process.env.UPLOADTHING_TOKEN) {
        console.error('Error: UPLOADTHING_TOKEN not set')
        process.exit(1)
    }

    try {
        const utapi = new UTApi({
            token: process.env.UPLOADTHING_TOKEN,
        })
        
        let buffer: Buffer
        let fileName: string

        const absolutePath = path.resolve(filenameOrPath)
        if (fs.existsSync(absolutePath)) {
             buffer = fs.readFileSync(absolutePath)
             fileName = path.basename(absolutePath)
        } else {
             try {
                buffer = fs.readFileSync(0) 
                fileName = path.basename(filenameOrPath) 
             } catch (readError) {
                 console.error('Error reading from stdin:', readError)
                 process.exit(1)
             }
        }
        
        const file = new File([buffer as any], fileName, { type: 'application/pdf' })
        
        const response = await utapi.uploadFiles([file])
        
        if (response[0]?.error) {
             console.error('UploadThing Error:', response[0].error)
             process.exit(1)
        }
        
        const data = response[0]?.data
        const url = data?.ufsUrl 
        
        if (url) {
            console.log(url) 
            process.exit(0)
        } else {
             console.error('Upload successful but no URL found in response')
             process.exit(1)
        }

    } catch (error) {
        console.error('Exception during upload:', error)
        process.exit(1)
    }
}

main()
