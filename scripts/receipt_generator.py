import os
import sys
import json
import subprocess
import requests
import psycopg2
from datetime import datetime
from decimal import Decimal
import argparse
from pathlib import Path
from dotenv import load_dotenv

import qrcode
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL")
UPLOADTHING_TOKEN = os.getenv("UPLOADTHING_TOKEN")
SERVER_URL = os.getenv("SERVER_URL") or "http://localhost:4000"

# Paths
ASSETS_DIR = Path(__file__).parent.parent / 'src' / 'assets'
TEMPLATE_PATH = ASSETS_DIR / 'receipt_template.png'
LOG_FILE = Path(__file__).parent.parent / 'logs' / 'receipt_generation_py.log'

def log(message):
    timestamp = datetime.now().isoformat()
    msg = f"[{timestamp}] {message}"
    print(msg)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(msg + "\n")
    except Exception as e:
        print(f"Failed to log to file: {e}")

def number_to_words(amount):
    a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen ']
    b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    if amount == 0:
        return 'Zero'
    
    if amount < 20:
        return a[amount]
    
    if amount < 100:
        return b[amount // 10] + ((' ' + a[amount % 10]) if (amount % 10 != 0) else '')
    
    if amount < 1000:
        return a[amount // 100] + 'Hundred ' + (('and ' + number_to_words(amount % 100)) if (amount % 100 != 0) else '')
    
    if amount < 100000:
        return number_to_words(amount // 1000) + 'Thousand ' + ((' ' + number_to_words(amount % 1000)) if (amount % 1000 != 0) else '')

    if amount < 10000000:
        return number_to_words(amount // 100000) + 'Lakh ' + ((' ' + number_to_words(amount % 100000)) if (amount % 100000 != 0) else '')
    
    return str(amount)

def generate_qr_code(data):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to bytes for ReportLab
    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

def create_pdf(order_data, user_data):
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"Template not found at {TEMPLATE_PATH}")

    buffer = BytesIO()
    
    # Original template dimensions from TS file
    template_width = 3720
    template_height = 2631
    
    c = canvas.Canvas(buffer, pagesize=(template_width, template_height))
    
    # Draw Template
    c.drawImage(str(TEMPLATE_PATH), 0, 0, width=template_width, height=template_height)
    
    # Settings (matching TS)
    font_size = 56
    c.setFont("Helvetica", font_size)
    c.setFillColorRGB(0, 0, 0)
    
    # Section 1: User Details
    user_details_left_margin = 880
    user_details_top_start = template_height - 635
    user_details_line_spacing = 128
    
    payment_details_left_margin = 880
    payment_details_top_start = template_height - 1125
    payment_details_line_spacing = 132
    
    amount_details_left_margin = 880
    amount_details_top_start = template_height - 1770
    amount_details_line_spacing = 180
    
    # Draw User Details
    c.drawString(user_details_left_margin, user_details_top_start, user_data['name'])
    c.drawString(user_details_left_margin, user_details_top_start - user_details_line_spacing, user_data['email'])
    c.drawString(user_details_left_margin, user_details_top_start - (user_details_line_spacing * 2), user_data['phoneNumber'])

    # Determine Payment Type String
    payment_type_str = 'Fest Registration'
    if order_data['type'] == 'ACC_REGISTRATION':
        payment_type_str = 'Accommodation Registration'
    elif order_data['type'] == 'EVENT_REGISTRATION':
        payment_type_str = 'Event Registration'
        
    c.drawString(payment_details_left_margin, payment_details_top_start, payment_type_str)
    c.drawString(payment_details_left_margin, payment_details_top_start - payment_details_line_spacing, order_data['orderId'])

    payment_data = order_data.get('paymentData', {}) or {}
    # Handle if paymentData is string (JSON) or dict
    if isinstance(payment_data, str):
        try:
            payment_data = json.loads(payment_data)
        except:
             payment_data = {}
             
    payment_id = payment_data.get('id') or payment_data.get('gatewayPaymentId') or '-'
    c.drawString(payment_details_left_margin, payment_details_top_start - (payment_details_line_spacing * 2), str(payment_id))
    
    method = payment_data.get('method') or '-'
    c.drawString(payment_details_left_margin, payment_details_top_start - (payment_details_line_spacing * 3), str(method).upper())

    # Amount
    c.drawString(amount_details_left_margin, amount_details_top_start, f"Rs. {order_data['collectedAmount']}/-")
    words = number_to_words(order_data['collectedAmount']) + ' Only'
    c.drawString(amount_details_left_margin, amount_details_top_start - amount_details_line_spacing - 10, words)

    # QR Code
    server_url = SERVER_URL
    qr_content = f"{server_url}/api/payment/receipt/{order_data['orderId']}/verify?paymentId={payment_id}"
    log(f"Generated QR Link: {qr_content}")
    
    qr_img = generate_qr_code(qr_content)
    qr_reader = ImageReader(qr_img)
    
    qr_code_x = 2855
    qr_code_y = 1315
    qr_code_size = 500
    
    c.drawImage(qr_reader, qr_code_x, qr_code_y, width=qr_code_size, height=qr_code_size)
    
    c.save()
    buffer.seek(0)
    return buffer

def upload_to_uploadthing(file_buffer, filename):
    try:
        # Construct command to run the TS helper
        script_path = ASSETS_DIR.parent.parent / 'scripts' / 'upload_helper.ts'
        
        log(f"Initiating upload via Node.js helper for {filename}...")
        
        if not os.path.exists(script_path):
             log(f"Helper script not found at {script_path}")
             return None

        # Use npx to run ts-node.
        cwd = ASSETS_DIR.parent.parent
        npx_cmd = 'npx.cmd' if os.name == 'nt' else 'npx'
        
        # Pass filename as argument, content via stdin
        result = subprocess.run(
            [npx_cmd, 'ts-node', str(script_path), filename],
            cwd=cwd,
            input=file_buffer.getvalue(), # Pass PDF bytes directly
            capture_output=True, # Captures stdout/stderr as bytes (since text is not True)
            env=os.environ
        )
        
        if result.returncode == 0:
            # Parse output line by line to find the URL (ignoring dotenv logs)
            output_lines = result.stdout.decode('utf-8').strip().split('\n')
            url = None
            for line in output_lines:
                clean_line = line.strip()
                if clean_line.startswith('https://'):
                    url = clean_line
                    break
            
            if url:
                log(f"Upload successful. URL: {url}")
                return url
            else:
                log(f"Upload finished but no URL found in output: {output_lines}")
                return None
        else:
            stderr_text = result.stderr.decode('utf-8')
            log(f"Upload failed. Stderr: {stderr_text}")
            return None

    except Exception as e:
        log(f"Error executing upload helper: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description='Generate Receipt')
    parser.add_argument('order_id', help='Order ID to generate receipt for')
    args = parser.parse_args()
    
    order_id = args.order_id
    log(f"Starting receipt generation for {order_id}")
    
    params = {
        "host": "aws-0-1.db.pool.vercel-storage.com",
        "dbname": "neondb",
        "user": "default",
        # Parse DATABASE_URL for these if needed, or rely on libpq handling the connection string
    }
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Fetch Data
        query = """
            SELECT po."orderId", po."collectedAmount", po."type", po."paymentDataJson", 
                   u."name", u."email", u."phoneNumber" 
            FROM "PaymentOrder" po 
            JOIN "User" u ON po."userId" = u."id" 
            WHERE po."orderId" = %s
        """
        cur.execute(query, (order_id,))
        row = cur.fetchone()
        
        if not row:
            log("Order not found")
            return

        order_data = {
            "orderId": row[0],
            "collectedAmount": row[1],
            "type": row[2],
            "paymentData": row[3]
        }
        
        user_data = {
            "name": row[4],
            "email": row[5],
            "phoneNumber": row[6]
        }
        
        # Generate PDF
        pdf_buffer = create_pdf(order_data, user_data)
        
        # Upload
        filename = f"receipt_{order_id}.pdf"
        url = upload_to_uploadthing(pdf_buffer, filename)
        
        if url:
            # Update DB
            update_query = """
                UPDATE "PaymentOrder" 
                SET "receipt" = %s 
                WHERE "orderId" = %s
            """
            cur.execute(update_query, (url, order_id))
            conn.commit()
            log(f"Database updated with receipt URL: {url}")
        else:
            log("Upload failed or skipped, DB not updated.")

        cur.close()
        conn.close()

    except Exception as e:
        log(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
