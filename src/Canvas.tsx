import React, {Ref, RefObject, useEffect} from 'react';
import {
    AmbientLight, AnimationClip,
    AnimationMixer,
    BoxGeometry, Camera,
    Color, DirectionalLight, Group,
    Mesh,
    MeshBasicMaterial, MeshPhongMaterial,
    Object3D,
    PerspectiveCamera, Raycaster,
    Scene, Vector3
} from 'three';
import {Renderer} from 'expo-three';
import {ExpoWebGLRenderingContext, GLView} from 'expo-gl';
import {Asset} from "expo-asset";
import * as FileSystem from "expo-file-system";
import {CustomGLTFLoader} from "./lib/CustomGLTFLoader";
import {GLTF} from "three/examples/jsm/loaders/GLTFLoader";
import {degToRad} from "three/src/math/MathUtils";
import {GestureResponderEvent, PanResponder, PixelRatio} from "react-native";

const foxAsset = Asset.fromModule(require("./assets/fox.gltf"));
const chickenAsset = Asset.fromModule(require("./assets/chicken.gltf"));
const loader = new CustomGLTFLoader();
const loader2 = new CustomGLTFLoader();

const raycaster = new Raycaster()

export default function CanvasComponent(props: {}) {

    let floorReference: Object3D | null = null
    let foxReference: Object3D | null = null
    let cameraReference: Camera | null = null
    let canvasSize: { x:number, y:number } | null = null

    const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
        const pixelStorei = gl.pixelStorei.bind(gl)
        gl.pixelStorei = function(...args) {
            const [parameter] = args
            switch(parameter) {
                case gl.UNPACK_FLIP_Y_WEBGL:
                    return pixelStorei(...args)
            }
        };

        await foxAsset.downloadAsync();
        await chickenAsset.downloadAsync();
        const foxFile = await FileSystem.readAsStringAsync(foxAsset.localUri);
        const chickenFile = await FileSystem.readAsStringAsync(chickenAsset.localUri);


        const scene = new Scene();
        const foxGltfLoaded: GLTF = await loader.parseAsync(foxFile, foxAsset.localUri)
            .catch(error => console.log('parse Error: ', error));
        const foxRoot: Group = foxGltfLoaded.scene
        foxReference = foxRoot
        foxRoot.userData = {
            target: new Vector3(4,0,3),
            speed: 3,
        }
        const foxAnimationMixer = new AnimationMixer(foxRoot);
        const foxRunClip = AnimationClip.findByName(foxGltfLoaded.animations, "Run")
        const foxIdleClip = AnimationClip.findByName(foxGltfLoaded.animations, "Idle")
        foxAnimationMixer
            .clipAction(foxRunClip)
            .play()

        const chickenGltfLoaded: GLTF = await loader2.parseAsync(chickenFile, chickenAsset.localUri)
            .catch(error => console.log('parse Error: ', error));
        const chickenRoot: Group = chickenGltfLoaded.scene
        chickenRoot.userData = {
            target: new Vector3(-2,0,-3),
            speed: 0.6,
        }
        const chickenAnimationMixer = new AnimationMixer(chickenRoot);
        chickenAnimationMixer
            .clipAction(AnimationClip.findByName(chickenGltfLoaded.animations, "Walk"))
            .play()

        floorReference = new Mesh(new BoxGeometry(16, 1, 20), new MeshPhongMaterial({color: 0x9c9c9c}))
        floorReference.position.setY(-0.5)

        scene.add(floorReference)
        scene.add(foxRoot)
        foxRoot.position.set(-1, 0, 0)
        scene.add(chickenRoot)
        chickenRoot.position.set(1, 0, 0)

        console.log('creating scene', gl);
        // three.js implementation.
        scene.background = new Color(0xa8a8a8);
        cameraReference = new PerspectiveCamera(
            75,
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.1,
            1000
        );

        // set camera position away from cube
        cameraReference.position.z = 15;
        cameraReference.position.y = 5;
        cameraReference.lookAt(new Vector3(0,0,0))

        const renderer = new Renderer({gl});
        // set size of buffer to be equal to drawing buffer width
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

        // add cube to scene
        scene.add(new AmbientLight(0xffffff, 0.5))
        scene.add(new DirectionalLight(0xffffff, 0.4))

        // create render function
        let frameStartTime = Date.now();
        const render = () => {
            requestAnimationFrame(render);
            const curr = Date.now();
            const deltaTimeMs = (curr - frameStartTime);
            const deltaTimeS = deltaTimeMs * 0.001;
            frameStartTime = curr;

            foxAnimationMixer.update(deltaTimeS)
            chickenAnimationMixer.update(deltaTimeS)

            // fox movement
            const foxTarget: Vector3 = foxRoot.userData.target
            const foxToMove = new Vector3().copy(foxTarget).sub(foxRoot.position)
            if(foxToMove.length() > 0.1) {
                const foxMove = foxToMove.normalize().multiplyScalar(foxRoot.userData.speed * deltaTimeS)
                foxRoot.lookAt(foxTarget)
                foxRoot.position.add(foxMove)
                foxAnimationMixer.clipAction(foxIdleClip).stop()
                foxAnimationMixer.clipAction(foxRunClip).play()
            } else {
                foxAnimationMixer.clipAction(foxRunClip).stop()
                foxAnimationMixer.clipAction(foxIdleClip).play()
            }
            
            // chicken movement
            const chickenTarget: Vector3 = chickenRoot.userData.target
            const chickenToMove = new Vector3().copy(chickenTarget).sub(chickenRoot.position)
            if(chickenToMove.length() > 0.1) {
                const chickenMove = chickenToMove.normalize().multiplyScalar(chickenRoot.userData.speed * deltaTimeS)
                chickenRoot.lookAt(chickenTarget)
                chickenRoot.rotateY(degToRad(-90));
                chickenRoot.position.add(chickenMove)
            } else {
                const x = Math.random() * 10 - 5;
                const z = Math.random() * 10 - 5;
                chickenRoot.userData.target = new Vector3(x, 0, z)
            }



            renderer.render(scene, cameraReference);
            gl.endFrameEXP();
        };
        // call render
        canvasSize = {
            x: gl.drawingBufferWidth,
            y: gl.drawingBufferHeight
        }
        render();
    };
    const onTouchDown = (ev: GestureResponderEvent) => {
        if(foxReference !== null && cameraReference !== null && canvasSize !== null) {
            const relativePosition = {
                x: (PixelRatio.getPixelSizeForLayoutSize(ev.nativeEvent.locationX) / canvasSize.x) * 2 - 1,
                y: (1 - (PixelRatio.getPixelSizeForLayoutSize(ev.nativeEvent.locationY) / canvasSize.y)) * 2 - 1,
            }
            raycaster.setFromCamera(relativePosition, cameraReference)
            const intersects = raycaster.intersectObject(floorReference)
            if(intersects.length > 0) {
                foxReference.userData.target = new Vector3(intersects[0].point.x, 0, intersects[0].point.z,)
            }
        }
    }
    return (<GLView style={{width: '100%', height: '100%'}} onContextCreate={onContextCreate} onTouchStart={onTouchDown} onTouchMove={onTouchDown} />);
}