
import { UTApi } from "uploadthing/server";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const utapi = new UTApi();

export async function uploadReceipt(fileInput: string | { buffer: Buffer, name: string }): Promise<string | null> {
  try {
    let file: File;

    if (typeof fileInput === 'string') {
        const filePath = fileInput;
        if (!fs.existsSync(filePath)) {
            console.error("File does not exist:", filePath);
            return null;
        }
        
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        file = new File([fileBuffer], fileName);
    } else {
        file = new File([fileInput.buffer], fileInput.name);
    }

    const response = await utapi.uploadFiles([file]);
    
    if (response[0]?.data?.url) {
      return response[0].data.url;
    } else {
      console.error("Upload failed details:", JSON.stringify(response[0]?.error, null, 2));
      return null;
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    return null;
  }
}

if (require.main === module) {
    (async () => {
        const filePath = process.argv[2];
        if (!filePath) {
            console.error("Please provide a file path");
            process.exit(1);
        }
        const url = await uploadReceipt(filePath);
        if (url) {
            console.log(url);
            process.exit(0);
        } else {
            process.exit(1);
        }
    })();
}
