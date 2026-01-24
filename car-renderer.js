document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById('bmw-3d-container');
    const loaderElement = document.getElementById('model-loader');
    
    if (!container) return;

    const MODEL_PATH = 'assents/porschegt3.glb'; 
    const isMobile = window.innerWidth < 768;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(5, 2, 8);

    // Renderer Optimized
    const renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobile, // Desativa AA no mobile para performance
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    
    // PixelRatio inteligente (Economiza muita GPU no mobile)
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 1.3) : Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false; 
    controls.maxDistance = 15;
    controls.minDistance = 3;
    controls.enablePan = false; 
    controls.enableZoom = false; 

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const mainLight = new THREE.DirectionalLight(0xffffff, 2);
    mainLight.position.set(10, 10, 10);
    scene.add(mainLight);

    // Dynamic Lights (Simplified on mobile)
    if (!isMobile) {
        const blueLight = new THREE.PointLight(0x1c69d4, 4, 50);
        blueLight.position.set(-5, 5, 5);
        scene.add(blueLight);
    }

    // Shadow Plane
    const shadowGeometry = new THREE.PlaneGeometry(5, 5);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64; // Reduzido de 128 para 64 (performance)
    shadowCanvas.height = 64;
    const context = shadowCanvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0.1, 'rgba(0,0,0,0.6)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true });
    const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.15;
    scene.add(shadowPlane);

    // Particles (Reduced on mobile)
    const particlesCount = isMobile ? 60 : 200;
    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particlesCount * 3);
    for(let i = 0; i < particlesCount * 3; i++) posArray[i] = (Math.random() - 0.5) * 20;
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMesh = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({
        size: 0.02,
        color: 0x1c69d4,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    }));
    scene.add(particlesMesh);

    let model = null;
    let targetY = 0;
    let currentY = 5; 
    let hasReachedPosition = false;
    let isInitialized = false;
    let animationId = null;

    // --- LAZY LOADING & PERFORMANCE PAUSE ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!isInitialized) {
                    isInitialized = true;
                    loadModel();
                }
                if (!animationId) animate();
            } else {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
            }
        });
    }, { rootMargin: '100px' });

    observer.observe(container);

    window.addEventListener('scroll', () => {
        const rect = container.getBoundingClientRect();
        if (rect.top > window.innerHeight || rect.bottom < 0) {
            hasReachedPosition = false;
            currentY = 5; 
        } else if (rect.top < window.innerHeight * 0.8 && !hasReachedPosition) {
            hasReachedPosition = true;
        }
    });

    function loadModel() {
        const loader = new THREE.GLTFLoader();
        loader.load(MODEL_PATH, (gltf) => {
            model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const scale = 5 / Math.max(size.x, size.y, size.z);
            model.scale.set(scale, scale, scale);
            model.position.sub(center.multiplyScalar(scale));

            model.traverse((node) => {
                if (node.isMesh && node.material) {
                    node.material.envMapIntensity = isMobile ? 1 : 2;
                    node.material.needsUpdate = true;
                }
            });
            scene.add(model);
            if (loaderElement) {
                loaderElement.style.opacity = '0';
                setTimeout(() => loaderElement.style.display = 'none', 500);
            }
        }, (xhr) => {
            if (xhr.lengthComputable && loaderElement) {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                const text = loaderElement.querySelector('span');
                if (text) text.innerText = `Carregando: ${percent}%`;
            }
        });
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        if (model) {
            if (hasReachedPosition) currentY += (targetY - currentY) * 0.03; 
            model.rotation.z = currentY * 0.15;
            model.rotation.x = currentY * 0.05;
            model.rotation.y += 0.005;
            const floatY = Math.sin(Date.now() * 0.001) * 0.05;
            model.position.y = currentY + floatY;
            shadowPlane.material.opacity = Math.max(0, 1 - (currentY * 0.2));
        }
        particlesMesh.rotation.y += 0.001;
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
});
