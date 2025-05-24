import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import Stats from 'three/addons/libs/stats.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RapierPhysics } from 'three/addons/physics/RapierPhysics.js';
import { RapierHelper } from 'three/addons/helpers/RapierHelper.js';

let W = window.innerWidth
let H = window.innerHeight

// configuratie renderer
const renderer = new THREE.WebGLRenderer()
renderer.setSize(W, H)
document.getElementById('continut').appendChild(renderer.domElement)

// // redimensionarea camerei atunci cand dimensiunea paginii se schimba
// window.addEventListener('resize', () => {
//     W = window.innerWidth
//     H = window.innerHeight
//     camera.aspect = W / H
//     camera.updateProjectionMatrix()
//     renderer.setSize(W / H)
// })

// configuratie elemente ale scenei
const scene = new THREE.Scene()
scene.background = new THREE.Color('skyblue')
scene.add(new THREE.AxesHelper(100))
scene.add(new THREE.GridHelper(20, 40))

// configuratie lumini 
const hemi = new THREE.HemisphereLight(0x555555, 0xFFFFFF)
scene.add(hemi)

const dir = new THREE.DirectionalLight(0xFFFFFF, 4);
dir.position.set(0, 12.5, 12.5)
scene.add(dir)

// configuratie camera
const camera = new THREE.PerspectiveCamera(75, W / H, 0.01, 1000)
camera.position.set(0, 4, 10)
camera.lookAt(scene.position)

// geometrie
const geometry = new THREE.BoxGeometry(100, 0.5, 100);
const material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

const ground = new THREE.Mesh(geometry, material);
ground.receiveShadow = true;

ground.position.set(0, -0.64, - 20);
ground.userData.physics = { mass: 0 };

scene.add(ground);

// physics
// //Initialize physics engine using the script in the jsm/physics folder
const physics = await RapierPhysics()
// //Optionally display collider outlines
const physicsHelper = new RapierHelper(physics.world);
scene.add(physicsHelper);
physics.addScene(scene);

// modele + loader
const modelLoader = new GLTFLoader()
modelLoader.load('./models/orange-truck/source/model.gltf', (gltf) => {
    // 1. umbre
    gltf.scene.traverse(obj => {
        if (obj.isMesh) obj.castShadow = obj.receiveShadow = true;
    });
    const model = gltf.scene;

    /* 2. FIT MODEL TO SCENE */
    // bounding-box inițial
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetScale = 1 / maxDim;
    // aplică scalarea și recentrarea
    model.scale.setScalar(targetScale);
    model.position.sub(center.multiplyScalar(targetScale));

    /* 3. ALINIERE PE Y PE BAZA BOX-ULUI SCALED */
    // recomputează box după scalare și recenter
    const boxScaled = new THREE.Box3().setFromObject(model);
    const minY = boxScaled.min.y;          // cel mai jos punct după scala
    model.position.y -= minY;              // urcă modelul până la y=0

    /* 4. POZIȚIONEAZĂ ASFALTUL */
    // geometria are înălțime 0.5 ⇒ jumătate 0.25; ca suprafața asfaltului (top face) să fie la y=0:
    ground.position.y = -0.25;

    /* 5. FINAL */
    scene.add(model);
    controls.target.set(0, 0, 0);
    controls.update();
}, undefined, error => console.error(error));


const textureLoader = new THREE.TextureLoader()
textureLoader.load('./resources/textures/asfalt.jpg', (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(80, 80);
    ground.material.map = texture;
    ground.material.needsUpdate = true;
})

// addons
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
const stats = new Stats()
document.getElementById('continut').appendChild(stats.domElement)

// controale / event handlers
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'w':
        case 'ArrowUp':
            console.log('Inainte -- KEYDOWN')
            break
        case 'a':
        case 'ArrowLeft':
            console.log('Stanga -- KEYDOWN')
            break
        case 's':
        case 'ArrowDown':
            console.log('Inapoi -- KEYDOWN')
            break
        case 'd':
        case 'ArrowRight':
            console.log('Dreapta -- KEYDOWN')
            break
        case ' ':
            console.log('Frana -- KEYDOWN')
            break
    }
})

window.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'w':
        case 'ArrowUp':
            console.log('Inainte -- KEYUP')
            break
        case 'a':
        case 'ArrowLeft':
            console.log('Stanga -- KEYUP')
            break
        case 's':
        case 'ArrowDown':
            console.log('Inapoi -- KEYUP')
            break
        case 'd':
        case 'ArrowRight':
            console.log('Dreapta -- KEYUP')
            break
        case ' ':
            console.log('Frana -- KEYUP')
            break
    }
})

window.addEventListener('resize', () => {
    W, H = window.innerWidth, window.innerHeight
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    renderer.setSize(W, H)
})

// main loop
const animate = () => {
    controls.update()
    // const time = performance.now() / 1000
    renderer.render(scene, camera)
    stats.update()
}

renderer.setAnimationLoop(animate)

const main = () => {

}