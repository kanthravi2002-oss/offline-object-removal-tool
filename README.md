# Offline Object Removal Web Tool

A privacy-focused web application that removes unwanted objects from images using advanced inpainting algorithms. All processing happens locally on your machine - no internet required, no data sent to external servers.

## Features

- **Complete Privacy**: All image processing happens locally - your images never leave your computer
- **Easy to Use**: Simple drag-and-drop interface with interactive drawing tools
- **Fast Processing**: Uses OpenCV's optimized inpainting algorithms
- **Two Algorithms**: Choose between Telea (fast) or Navier-Stokes (quality) methods
- **Mobile Support**: Works on desktop and touch devices
- **No Setup Required**: Just upload, draw, and download

## How It Works

1. **Upload an Image**: Drag and drop or click to upload (PNG, JPG, WEBP supported)
2. **Mark Objects**: Draw over the objects you want to remove using the interactive brush
3. **Process**: Click "Remove Objects" to apply the inpainting algorithm
4. **Download**: Compare before/after and download your edited image

## Running Locally

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd object-removal-tool

# Build and run with Docker Compose
docker-compose up -d

# The application will be available at http://localhost:5000
```

### Using Python

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py

# Visit http://localhost:5000
```

## Deployment

### Docker Deployment

The project includes complete Docker configuration for easy deployment:

```bash
# Build the Docker image
docker build -t object-removal-tool .

# Run the container
docker run -p 5000:5000 -e SESSION_SECRET=your-secret-key object-removal-tool
```

### Production Considerations

- Set a secure `SESSION_SECRET` environment variable
- Use a reverse proxy (nginx, Caddy) for HTTPS
- Consider resource limits for concurrent users
- Monitor disk space for temporary uploads

## Technology Stack

- **Backend**: Python, Flask, OpenCV
- **Frontend**: HTML5 Canvas, Tailwind CSS, JavaScript
- **Image Processing**: OpenCV inpainting algorithms
- **Deployment**: Docker, Gunicorn

## Inpainting Methods

### Telea (Fast)
- Based on fast marching method
- Best for: Small to medium objects, quick results
- Processing time: Faster

### Navier-Stokes (Quality)
- Based on fluid dynamics
- Best for: Larger areas, higher quality output
- Processing time: Slower but better results

## System Requirements

- **Browser**: Modern browser with Canvas support (Chrome, Firefox, Safari, Edge)
- **Memory**: 2GB RAM minimum (4GB recommended)
- **Storage**: Minimal (temporary files are cleaned automatically)

## Supported Image Formats

- PNG
- JPEG/JPG
- WEBP

Maximum file size: 16MB

## Privacy & Security

- **No data collection**: Images are processed in memory and not stored
- **No external APIs**: Completely offline operation
- **Open source**: Full transparency - inspect the code yourself

## Limitations

- Processing speed depends on image size and marked area
- Best results with clean, well-defined objects
- Not suitable for very complex textures or patterns
- No GPU acceleration (uses CPU only)

## Future Enhancements

- Advanced AI models (LaMa, Stable Diffusion inpainting)
- Batch processing for multiple images
- Mask refinement tools
- GPU acceleration support
- Additional export options

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please open an issue on the repository.

---

**Note**: This tool uses classical inpainting algorithms. For best results with complex scenes, consider using AI-powered inpainting models (which require more computational resources or external APIs).
