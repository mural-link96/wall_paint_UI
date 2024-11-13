document.addEventListener('DOMContentLoaded', function() {
    const imageUpload = document.getElementById('imageUpload');
    const roomImage = document.getElementById('roomImage');
    const processImage = document.getElementById('processImage');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const segmentsContainer = document.getElementById('segmentsContainer');
    const segmentList = document.getElementById('segmentList');
    const colorPickerContainer = document.getElementById('colorPickerContainer');
    const colorPalette = document.getElementById('colorPalette');
    const colorPicker = document.getElementById('colorPicker');
    const hexInput = document.getElementById('hexInput');
    const redSlider = document.getElementById('redSlider');
    const greenSlider = document.getElementById('greenSlider');
    const blueSlider = document.getElementById('blueSlider');
    const applyToSegment = document.getElementById('applyToSegment');
    const clearSegment = document.getElementById('clearSegment');
    const applyAllColors = document.getElementById('applyAllColors');

    let originalImage = '';
    let highlightedImages = [];
    let currentColor = '#FFFFFF';
    let selectedSegment = null;
    let segmentColors = {};

    const roomColors = [
        '#F5F5F5', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575',  // Grays
        '#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9',  // Light pastels
        '#B3E5FC', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#F0F4C3',  // More light pastels
        '#FFE0B2', '#FFCCBC', '#D7CCC8', '#CFD8DC', '#F0F0F0',  // Neutrals
        '#C5E1A5', '#80CBC4', '#81D4FA', '#9FA8DA', '#CE93D8'   // Medium tones
    ];

    function initColorPalette() {
        roomColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => selectColor(color));
            colorPalette.appendChild(swatch);
        });
    }

    function selectColor(color) {
        currentColor = color;
        colorPicker.value = color;
        hexInput.value = color;
        updateSliders(color);
    }

    function updateSliders(color) {
        const rgb = hexToRgb(color);
        redSlider.value = rgb.r;
        greenSlider.value = rgb.g;
        blueSlider.value = rgb.b;
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    imageUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);

            axios.post('/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })
            .then(function (response) {
                roomImage.src = response.data.image_url;
                originalImage = response.data.image_url;
                processImage.disabled = false;
            })
            .catch(function (error) {
                console.error('Error:', error);
            });
        }
    });

    processImage.addEventListener('click', function() {
        progressBarContainer.classList.remove('hidden');

        axios.post('/process_image')
            .then(function (response) {
                const data = response.data;
                highlightedImages = data.highlighted_images;

                displaySegments(data.num_segments);
                progressBarContainer.classList.add('hidden');
            })
            .catch(function (error) {
                console.error('Error:', error);
                progressBarContainer.classList.add('hidden');
            });
    });

    function displaySegments(numSegments) {
        segmentList.innerHTML = '';
        for (let i = 0; i < numSegments; i++) {
            const li = document.createElement('li');
            li.innerHTML = `<span class="segment-color-indicator"></span>Segment ${i + 1}`;
            li.className = 'cursor-pointer hover:bg-gray-200 p-2 rounded flex items-center';
            li.addEventListener('click', () => selectSegment(i));
            segmentList.appendChild(li);
        }
    }

    function selectSegment(index) {
        selectedSegment = index;
        roomImage.src = `data:image/png;base64,${highlightedImages[index]}`;
        updateSegmentDisplay();
        if (segmentColors[index]) {
            selectColor(segmentColors[index]);
        } else {
            selectColor('#FFFFFF');  // Default to white if no color is selected
        }
    }

    function updateSegmentDisplay() {
        const segmentItems = segmentList.children;
        for (let i = 0; i < segmentItems.length; i++) {
            const colorIndicator = segmentItems[i].querySelector('.segment-color-indicator');
            colorIndicator.style.backgroundColor = segmentColors[i] || 'transparent';
        }
    }

    colorPicker.addEventListener('input', function(event) {
        selectColor(event.target.value);
    });

    hexInput.addEventListener('input', function(event) {
        selectColor(event.target.value);
    });

    redSlider.addEventListener('input', updateColorFromSliders);
    greenSlider.addEventListener('input', updateColorFromSliders);
    blueSlider.addEventListener('input', updateColorFromSliders);

    function updateColorFromSliders() {
        const color = rgbToHex(parseInt(redSlider.value), parseInt(greenSlider.value), parseInt(blueSlider.value));
        selectColor(color);
    }

    applyToSegment.addEventListener('click', function() {
        if (selectedSegment !== null) {
            segmentColors[selectedSegment] = currentColor;
            updateSegmentDisplay();
        }
    });

    clearSegment.addEventListener('click', function() {
        if (selectedSegment !== null) {
            delete segmentColors[selectedSegment];
            updateSegmentDisplay();
            selectColor('#FFFFFF');  // Reset to white after clearing
        }
    });

    applyAllColors.addEventListener('click', function() {
        progressBarContainer.classList.remove('hidden');

        axios.post('/apply_colors', { segment_colors: segmentColors })
            .then(function (response) {
                const coloredImage = `data:image/png;base64,${response.data.colored_image}`;
                roomImage.src = coloredImage;
                progressBarContainer.classList.add('hidden');
            })
            .catch(function (error) {
                console.error('Error applying colors:', error);
                progressBarContainer.classList.add('hidden');
                // You might want to show an error message to the user here
            });
    });

    // Initialize the color palette
    initColorPalette();
});