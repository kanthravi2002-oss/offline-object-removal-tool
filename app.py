import os
import io
import base64
from flask import Flask, render_template, request, jsonify, send_file
import cv2
import numpy as np
from PIL import Image
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SESSION_SECRET', 'dev-secret-key-change-in-production')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
UPLOAD_FOLDER = 'temp_uploads'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def base64_to_image(base64_string):
    """Convert base64 string to numpy array (OpenCV format)"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_data = base64.b64decode(base64_string)
    img_array = np.frombuffer(img_data, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    return img

def image_to_base64(img, format='PNG'):
    """Convert numpy array to base64 string"""
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    buffer = io.BytesIO()
    pil_img.save(buffer, format=format)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    return f"data:image/{format.lower()};base64,{img_base64}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    """Handle image upload"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Read image file
            file_bytes = file.read()
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return jsonify({'error': 'Invalid image file'}), 400
            
            # Convert to base64 for sending to frontend
            img_base64 = image_to_base64(img)
            
            return jsonify({
                'success': True,
                'image': img_base64,
                'width': img.shape[1],
                'height': img.shape[0]
            })
        else:
            return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, WEBP'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/inpaint', methods=['POST'])
def inpaint_image():
    """Process inpainting request"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data or 'mask' not in data:
            return jsonify({'error': 'Missing image or mask data'}), 400
        
        # Convert base64 images to OpenCV format
        img = base64_to_image(data['image'])
        mask = base64_to_image(data['mask'])
        
        if img is None or mask is None:
            return jsonify({'error': 'Invalid image or mask data'}), 400
        
        # Validate image and mask dimensions match
        if img.shape[:2] != mask.shape[:2]:
            return jsonify({
                'error': f'Image and mask dimensions must match. Image: {img.shape[1]}x{img.shape[0]}, Mask: {mask.shape[1]}x{mask.shape[0]}'
            }), 400
        
        # Convert mask to grayscale if needed
        if len(mask.shape) == 3:
            mask_gray = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
        else:
            mask_gray = mask
        
        # Ensure mask is binary (0 or 255)
        _, mask_binary = cv2.threshold(mask_gray, 127, 255, cv2.THRESH_BINARY)
        
        # Dilate the mask slightly to ensure complete coverage and remove edge artifacts
        kernel = np.ones((5, 5), np.uint8)
        mask_dilated = cv2.dilate(mask_binary, kernel, iterations=2)
        
        # Get inpainting method (default to TELEA)
        method = data.get('method', 'telea')
        
        # Use larger inpainting radius for better blending (10-15 pixels)
        inpaint_radius = 15
        
        # Apply inpainting with improved parameters
        if method == 'ns':
            # Navier-Stokes method - apply multiple times for better quality
            result = cv2.inpaint(img, mask_dilated, inpaint_radius, cv2.INPAINT_NS)
            # Second pass for cleaner results
            result = cv2.inpaint(result, mask_binary, inpaint_radius, cv2.INPAINT_NS)
        else:
            # Telea method (default) - apply multiple times for smoother blending
            result = cv2.inpaint(img, mask_dilated, inpaint_radius, cv2.INPAINT_TELEA)
            # Second pass with original mask for finer details
            result = cv2.inpaint(result, mask_binary, 10, cv2.INPAINT_TELEA)
        
        # Apply slight Gaussian blur to blend edges more naturally
        result = cv2.GaussianBlur(result, (0, 0), 0.5)
        
        # Sharpen slightly to restore detail (only where not inpainted)
        mask_inv = cv2.bitwise_not(mask_dilated)
        sharpening_kernel = np.array([[-0.5, -0.5, -0.5],
                                       [-0.5,  5.0, -0.5],
                                       [-0.5, -0.5, -0.5]])
        sharpened = cv2.filter2D(result, -1, sharpening_kernel)
        
        # Blend sharpened version only in non-inpainted areas
        mask_inv_norm = mask_inv.astype(float) / 255.0
        if len(result.shape) == 3:
            mask_inv_norm = cv2.cvtColor((mask_inv_norm * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR).astype(float) / 255.0
        result = (result * (1 - mask_inv_norm * 0.3) + sharpened * (mask_inv_norm * 0.3)).astype(np.uint8)
        
        # Convert result to base64
        result_base64 = image_to_base64(result)
        
        return jsonify({
            'success': True,
            'result': result_base64
        })
        
    except Exception as e:
        return jsonify({'error': f'Inpainting failed: {str(e)}'}), 500

@app.route('/download', methods=['POST'])
def download_image():
    """Download processed image"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Convert base64 to image
        img = base64_to_image(data['image'])
        
        if img is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        # Convert to RGB for PIL
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        
        # Save to bytes
        img_io = io.BytesIO()
        format_type = data.get('format', 'PNG').upper()
        pil_img.save(img_io, format=format_type, quality=95)
        img_io.seek(0)
        
        filename = f"inpainted_image.{format_type.lower()}"
        
        return send_file(
            img_io,
            mimetype=f'image/{format_type.lower()}',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        return jsonify({'error': f'Download failed: {str(e)}'}), 500

# Disable caching to ensure updates are visible
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
