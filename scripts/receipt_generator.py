import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

import qrcode
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.barcode import code128
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Drawing
from io import BytesIO

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configuration
SERVER_URL = os.getenv("SERVER_URL") or "http://localhost:4000"

# Paths
ASSETS_DIR = Path(__file__).parent.parent / 'src' / 'assets'
TEMPLATE_PATH = ASSETS_DIR / 'Receipt-Template.png'
LOG_FILE = Path(__file__).parent.parent / 'logs' / 'receipt_generation_py.log'
GENERATED_DIR = ASSETS_DIR / 'generated_receipts'

def log(message):
    timestamp = datetime.now().isoformat()
    msg = f"[{timestamp}] {message}"
    # Use stderr for logs so stdout is clean for file path
    print(msg, file=sys.stderr)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(msg + "\n")
    except Exception as e:
        print(f"Failed to log to file: {e}", file=sys.stderr)

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
    template_width = 2480
    template_height = 3100
    
    c = canvas.Canvas(buffer, pagesize=(template_width, template_height))
    
    # Draw Template
    log("Drawing template...")
    c.drawImage(str(TEMPLATE_PATH), 0, 0, width=template_width, height=template_height)
    
    # Settings (matching TS)
    font_size = 36
    c.setFont("Helvetica", font_size)
    c.setFillColorRGB(0, 0, 0)
    
    # Section 1: User Details
    user_details_left_margin = 620
    user_details_top_start = template_height - 821
    user_details_line_spacing = 89 # Reduced spacing for smaller font
    
    # Draw User Details
    c.drawString(user_details_left_margin, user_details_top_start, user_data['name'])
    c.drawString(user_details_left_margin, user_details_top_start - user_details_line_spacing, user_data['email'])
    c.drawString(user_details_left_margin, user_details_top_start - (user_details_line_spacing * 2), user_data['phoneNumber'])
    
    # Add College
    college = user_data.get('college', '-')
    c.drawString(user_details_left_margin, user_details_top_start - (user_details_line_spacing * 3), str(college))
    
    # Add PID (Separate Position)
    pid_top_start = template_height - 2966 # Adjustable
    pid_left_margin = 300
    pid = user_data.get('pid', '-')
    c.drawString(pid_left_margin, pid_top_start, f"{pid}")

    # Section 2: Payment Details (Adjusted Start)
    payment_details_left_margin = 620
    payment_details_top_start = template_height - 1323 # Adjusted to avoid overlap
    payment_details_line_spacing = 88 # Reduced spacing for smaller font
    
    # Determine Payment Type String
    payment_type_str = 'Fest Registration'
    if order_data['type'] == 'ACC_REGISTRATION':
        payment_type_str = 'Accomodation Fee Payment'
    elif order_data['type'] == 'EVENT_REGISTRATION':
        payment_type_str = 'Event Registration'
        
    # 1. Payment Type
    c.drawString(payment_details_left_margin, payment_details_top_start, payment_type_str)

    # 2. Date of Payment
    payment_date = order_data.get('updatedAt')
    if payment_date:
        if isinstance(payment_date, str):
            try:
                # Handle ISO format "2023-01-01T12:00:00.000Z"
                payment_date = datetime.fromisoformat(payment_date.replace('Z', '+00:00'))
            except:
                pass
        if isinstance(payment_date, datetime):
            payment_date_str = payment_date.strftime("%d/%m/%Y")
        else:
             payment_date_str = str(payment_date)
    else:
        payment_date_str = '-'
    c.drawString(payment_details_left_margin, payment_details_top_start - payment_details_line_spacing, f"{payment_date_str}")

    # 3. Order ID
    c.drawString(payment_details_left_margin, payment_details_top_start - (payment_details_line_spacing * 2), order_data['orderId'])

    payment_data = order_data.get('paymentData', {}) or {}
    if isinstance(payment_data, str):
        try:
            payment_data = json.loads(payment_data)
        except:
             payment_data = {}
             
    payment_id = payment_data.get('id') or payment_data.get('gatewayPaymentId') or '-'
    
    # 4. Payment ID
    c.drawString(payment_details_left_margin, payment_details_top_start - (payment_details_line_spacing * 3), str(payment_id))
    
    method = payment_data.get('method') or '-'
    
    # 5. Payment Method
    c.drawString(payment_details_left_margin, payment_details_top_start - (payment_details_line_spacing * 4), str(method).upper())
    
    # Receipt Generation Details (Separate Position)
    gen_date_left_margin = 1650
    gen_date_top_start = template_height - 535 # Adjustable
    receipt_date = datetime.now().strftime("%d/%m/%Y")
    c.drawString(gen_date_left_margin, gen_date_top_start, f"{receipt_date}")

    # Amount
    amount = int(order_data['collectedAmount'])
    amount_details_left_margin = 620
    amount_details_top_start = template_height - 1900
    amount_details_line_spacing = 169
    
    c.drawString(amount_details_left_margin, amount_details_top_start, f"Rs. {amount}/-")
    words = number_to_words(amount) + ' Only'
    c.drawString(amount_details_left_margin, amount_details_top_start - amount_details_line_spacing - 10, words)

    # QR Code
    server_url = SERVER_URL
    qr_content = f"{server_url}/api/payment/receipt/{order_data['orderId']}/verify?paymentId={payment_id}"
    log(f"Generated QR Link: {qr_content}")
    
    qr_img = generate_qr_code(qr_content)
    log("QR code image generated in memory.")
    qr_reader = ImageReader(qr_img)
    
    # Updated coordinates for 2480 width
    qr_code_x = 1896
    qr_code_y = 1750
    qr_code_size = 350
    
    log(f"Drawing QR code at {qr_code_x}, {qr_code_y}")
    c.drawImage(qr_reader, qr_code_x, qr_code_y, width=qr_code_size, height=qr_code_size)
    
    # Barcode for PID (Separate Position)
    barcode_x = 1850
    barcode_y = 98
    
    if pid and pid != '-':
        log(f"Drawing Barcode for PID: {pid}")
        barcode = code128.Code128(pid, barHeight=80, barWidth=2.5) # Adjusted size
        barcode.drawOn(c, barcode_x, barcode_y)

    log("Saving PDF canvas...")
    c.save()
    log("PDF canvas saved.")
    buffer.seek(0)
    return buffer

def main():
    parser = argparse.ArgumentParser(description='Generate Receipt from JSON')
    parser.add_argument('input', help='JSON string or path to JSON file containing order and user data')
    args = parser.parse_args()
    
    try:
        input_data = args.input
        if os.path.exists(input_data):
            try:
                with open(input_data, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                log(f"Failed to read JSON file: {e}")
                sys.exit(1)
        else:
            data = json.loads(input_data)
            
        order_data = data.get('order_data')
        user_data = data.get('user_data')
        
        if not order_data or not user_data:
            log("Invalid JSON data: Missing order_data or user_data")
            sys.exit(1)
            
        log(f"Starting receipt generation for {order_data.get('orderId')}")
        
        # Generate PDF
        pdf_buffer = create_pdf(order_data, user_data)
        
        # Save to file
        os.makedirs(GENERATED_DIR, exist_ok=True)
        filename = f"receipt_{order_data.get('orderId')}.pdf"
        file_path = GENERATED_DIR / filename
        
        with open(file_path, "wb") as f:
            f.write(pdf_buffer.getvalue())
            
        # Output ONLY the file path to stdout
        print(str(file_path.absolute()))
        log(f"Receipt generated at: {file_path}")

    except json.JSONDecodeError:
        log("Failed to decode JSON input")
        sys.exit(1)
    except Exception as e:
        log(f"Error: {e}")
        # Print error details to stderr
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
