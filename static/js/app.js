// Application state
const state = {
    originalImage: null,
    processedImage: null,
    imageCanvas: null,
    maskCanvas: null,
    imageCtx: null,
    maskCtx: null,
    isDrawing: false,
    brushSize: 20,
    drawHistory: [],
    currentImage: null,
    isEraser: false
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Get DOM elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const brushSizeInput = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    const brushBtn = document.getElementById('brushBtn');
    const eraserBtn = document.getElementById('eraserBtn');
    const clearBtn = document.getElementById('clearBtn');
    const undoBtn = document.getElementById('undoBtn');
    const processBtn = document.getElementById('processBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const newImageBtn = document.getElementById('newImageBtn');
    
    state.imageCanvas = document.getElementById('imageCanvas');
    state.maskCanvas = document.getElementById('maskCanvas');
    state.imageCtx = state.imageCanvas.getContext('2d');
    state.maskCtx = state.maskCanvas.getContext('2d');
    
    // File upload events
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // Tool selection
    brushBtn.addEventListener('click', () => setTool('brush'));
    eraserBtn.addEventListener('click', () => setTool('eraser'));
    
    // Brush size control
    brushSizeInput.addEventListener('input', (e) => {
        state.brushSize = parseInt(e.target.value);
        brushSizeValue.textContent = state.brushSize;
    });
    
    // Canvas drawing events
    state.maskCanvas.addEventListener('mousedown', startDrawing);
    state.maskCanvas.addEventListener('mousemove', draw);
    state.maskCanvas.addEventListener('mouseup', stopDrawing);
    state.maskCanvas.addEventListener('mouseleave', stopDrawing);
    
    // Touch events for mobile
    state.maskCanvas.addEventListener('touchstart', handleTouchStart);
    state.maskCanvas.addEventListener('touchmove', handleTouchMove);
    state.maskCanvas.addEventListener('touchend', stopDrawing);
    
    // Button events
    clearBtn.addEventListener('click', clearMask);
    undoBtn.addEventListener('click', undoLastStroke);
    processBtn.addEventListener('click', processImage);
    downloadBtn.addEventListener('click', downloadImage);
    newImageBtn.addEventListener('click', resetApp);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadImage(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        uploadImage(files[0]);
    }
}

function setTool(tool) {
    const brushBtn = document.getElementById('brushBtn');
    const eraserBtn = document.getElementById('eraserBtn');
    
    if (tool === 'brush') {
        state.isEraser = false;
        brushBtn.classList.remove('bg-white', 'text-gray-700', 'border-2', 'border-gray-300');
        brushBtn.classList.add('bg-red-600', 'text-white');
        eraserBtn.classList.remove('bg-red-600', 'text-white');
        eraserBtn.classList.add('bg-white', 'text-gray-700', 'border-2', 'border-gray-300');
        state.maskCanvas.style.cursor = 'crosshair';
    } else {
        state.isEraser = true;
        eraserBtn.classList.remove('bg-white', 'text-gray-700', 'border-2', 'border-gray-300');
        eraserBtn.classList.add('bg-red-600', 'text-white');
        brushBtn.classList.remove('bg-red-600', 'text-white');
        brushBtn.classList.add('bg-white', 'text-gray-700', 'border-2', 'border-gray-300');
        state.maskCanvas.style.cursor = 'pointer';
    }
}

function uploadImage(file) {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError('Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.');
        return;
    }
    
    // Validate file size (16MB)
    if (file.size > 16 * 1024 * 1024) {
        showError('File too large. Maximum size is 16MB.');
        return;
    }
    
    showLoading();
    
    const formData = new FormData();
    formData.append('image', file);
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            loadImageToCanvas(data.image);
            state.currentImage = data.image;
            showSection('canvasSection');
        } else {
            showError(data.error || 'Upload failed');
        }
    })
    .catch(error => {
        hideLoading();
        showError('Upload failed: ' + error.message);
    });
}

function loadImageToCanvas(imageData) {
    const img = new Image();
    img.onload = function() {
        // Set canvas dimensions
        const maxWidth = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        
        state.imageCanvas.width = width;
        state.imageCanvas.height = height;
        state.maskCanvas.width = width;
        state.maskCanvas.height = height;
        
        // Draw image
        state.imageCtx.drawImage(img, 0, 0, width, height);
        
        // Clear mask
        state.maskCtx.clearRect(0, 0, width, height);
        state.drawHistory = [];
        
        // Store the resized canvas image as base64 to match mask dimensions
        state.currentImage = state.imageCanvas.toDataURL('image/png');
        state.originalImage = state.currentImage;
    };
    img.src = imageData;
}

function startDrawing(e) {
    state.isDrawing = true;
    state.drawHistory.push(state.maskCtx.getImageData(0, 0, state.maskCanvas.width, state.maskCanvas.height));
    draw(e);
}

function draw(e) {
    if (!state.isDrawing) return;
    
    const rect = state.maskCanvas.getBoundingClientRect();
    
    // Calculate scale factor between canvas internal dimensions and displayed size
    const scaleX = state.maskCanvas.width / rect.width;
    const scaleY = state.maskCanvas.height / rect.height;
    
    // Get mouse position relative to canvas and scale to internal coordinates
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (state.isEraser) {
        // Eraser mode - use destination-out composite operation
        state.maskCtx.globalCompositeOperation = 'destination-out';
        state.maskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        state.maskCtx.beginPath();
        state.maskCtx.arc(x, y, state.brushSize / 2, 0, Math.PI * 2);
        state.maskCtx.fill();
        state.maskCtx.globalCompositeOperation = 'source-over';
    } else {
        // Brush mode - draw red mask
        state.maskCtx.fillStyle = 'rgba(255, 0, 0, 0.6)';
        state.maskCtx.beginPath();
        state.maskCtx.arc(x, y, state.brushSize / 2, 0, Math.PI * 2);
        state.maskCtx.fill();
    }
}

function stopDrawing() {
    state.isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    state.maskCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    state.maskCanvas.dispatchEvent(mouseEvent);
}

function clearMask() {
    state.maskCtx.clearRect(0, 0, state.maskCanvas.width, state.maskCanvas.height);
    state.drawHistory = [];
}

function undoLastStroke() {
    if (state.drawHistory.length > 0) {
        const lastState = state.drawHistory.pop();
        state.maskCtx.putImageData(lastState, 0, 0);
    }
}

function processImage() {
    // Check if mask has any content
    const maskData = state.maskCtx.getImageData(0, 0, state.maskCanvas.width, state.maskCanvas.height);
    const hasContent = maskData.data.some(value => value > 0);
    
    if (!hasContent) {
        showError('Please mark the areas you want to remove by drawing on the image.');
        return;
    }
    
    showLoading();
    
    // Get mask as white on black background for inpainting
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.maskCanvas.width;
    tempCanvas.height = state.maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Fill black background
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw mask in white
    const imageData = state.maskCtx.getImageData(0, 0, state.maskCanvas.width, state.maskCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
    }
    tempCtx.putImageData(imageData, 0, 0);
    
    const maskBase64 = tempCanvas.toDataURL('image/png');
    const method = document.getElementById('inpaintMethod').value;
    
    fetch('/inpaint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: state.currentImage,
            mask: maskBase64,
            method: method,
            radius: 3
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            state.processedImage = data.result;
            showResults();
        } else {
            showError(data.error || 'Processing failed');
        }
    })
    .catch(error => {
        hideLoading();
        showError('Processing failed: ' + error.message);
    });
}

function showResults() {
    document.getElementById('beforeImage').src = state.originalImage;
    document.getElementById('afterImage').src = state.processedImage;
    showSection('resultsSection');
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function downloadImage() {
    // Try direct download first
    const a = document.createElement('a');
    a.href = state.processedImage;
    a.download = 'inpainted_image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Show success message with alternative option
    setTimeout(() => {
        alert('Download started! If the download didn\'t start automatically, right-click the "After" image and select "Save image as..."');
    }, 100);
}

function resetApp() {
    state.originalImage = null;
    state.processedImage = null;
    state.currentImage = null;
    state.drawHistory = [];
    
    document.getElementById('fileInput').value = '';
    hideSection('canvasSection');
    hideSection('resultsSection');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.remove('hidden');
    section.classList.add('fade-in');
}

function hideSection(sectionId) {
    document.getElementById(sectionId).classList.add('hidden');
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showError(message) {
    alert(message);
}
