from flask import Flask, render_template, request, jsonify, url_for
import requests
import base64
from PIL import Image
import io
import os
import numpy as np

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Replace with your Image Processing Azure Function URL
IMAGE_PROCESSING_FUNCTION_URL = "https://image-segment-app.azurewebsites.net/api/image_segment?code=i8v1QIf4WAXuIOlIN7DAObZEjHBLdAsFZOUNY4Kmz6IqAzFu2mnfow%3D%3D"

# Replace with your Color Application Azure Function URL
COLOR_APPLICATION_FUNCTION_URL = "https://app-colour-specfic-segments.azurewebsites.net/api/color__specific_segment?code=xwGtZv85bODUb1qoTQ78SQsVW6AE_7CduoRsfD-1VHLOAzFuZINwMA%3D%3D"

# Global variable to store segmentation masks
segmentation_masks = []

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'})
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'})
        if file:
            # Save the file temporarily
            filename = 'temp_image.png'
            file_path = os.path.join('static', filename)
            file.save(file_path)
            return jsonify({'image_url': url_for('static', filename=filename)})
    return render_template('index.html')

@app.route('/process_image', methods=['POST'])
def process_image():
    global segmentation_masks
    image_path = os.path.join('static', 'temp_image.png')
    with open(image_path, "rb") as image_file:
        image_data = image_file.read()
    
    response = requests.post(
        IMAGE_PROCESSING_FUNCTION_URL,
        data=image_data,
        headers={"Content-Type": "application/octet-stream"}
    )

    if response.status_code == 200:
        result = response.json()
        
        # Store segmentation masks
        segmentation_masks = [
            np.frombuffer(base64.b64decode(mask), dtype=np.uint8).reshape(Image.open(image_path).size[::-1])
            for mask in result['mask_segments']
        ]
        
        # Create highlighted images
        original_image = Image.open(image_path)
        original_array = np.array(original_image)
        highlighted_images = []
        
        for mask in segmentation_masks:
            highlighted_image = original_array.copy()
            # Reduce brightness of non-segment areas
            highlighted_image = highlighted_image.astype(float)
            highlighted_image[mask == 0] *= 0.7  # Reduce brightness to 70%
            highlighted_image = np.clip(highlighted_image, 0, 255).astype(np.uint8)
            
            img = Image.fromarray(highlighted_image)
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            highlighted_images.append(base64.b64encode(buffered.getvalue()).decode())

        return jsonify({
            'original_image': result['image'],
            'highlighted_images': highlighted_images,
            'num_segments': len(segmentation_masks)
        })
    else:
        return jsonify({'error': 'Image processing failed'})

@app.route('/apply_colors', methods=['POST'])
def apply_colors():
    global segmentation_masks
    color_data = request.json
    
    # Read the original image and encode it
    with open('static/temp_image.png', 'rb') as image_file:
        encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
    
    # Prepare the selected segments data
    selected_segments = {}
    for segment_index, color in color_data['segment_colors'].items():
        mask = segmentation_masks[int(segment_index)]
        encoded_mask = base64.b64encode(mask.tobytes()).decode('utf-8')
        
        selected_segments[segment_index] = {
            "mask": encoded_mask,
            "color": color
        }
    
    # Prepare data for the Azure Function
    azure_function_data = {
        'original_image': encoded_image,
        'selected_segments': selected_segments
    }
    
    # Call the Azure Function
    response = requests.post(
        COLOR_APPLICATION_FUNCTION_URL,
        json=azure_function_data,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        result = response.json()
        return jsonify({'colored_image': result['colored_image']})
    else:
        return jsonify({'error': 'Color application failed'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, port=port)