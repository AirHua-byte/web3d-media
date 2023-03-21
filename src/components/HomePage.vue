<script setup lang="ts">
import * as THREE from "three";
import Ammo from "ammo.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { onMounted } from "vue";
import { AnimationMixer } from "three";

let scene, renderer, camera, stats, controls;
let homeModel, model, skeleton, homeMixer, modelMixer, clock;
let moveState;
let dynamicsWorld;
let transformAux1 = new Ammo.btTransform();

// 动画状态机
class MoveState {
  animationsStatus = {
    stand: "idle",
    forward: "Run",
    back: "Run",
    left: "Walk",
    right: "Walk",
    jump: "Walk",
  };
  statuses = Object.keys(this.animationsStatus);

  private status: string;
  private mixer: AnimationMixer;
  private animations: Animation[];

  constructor(mixer, animations) {
    this.status = "stand";
    this.mixer = mixer;

    this.animations = animations;
    this.playAnimation();
  }

  getStatus() {
    return this.status;
  }

  playAnimation() {
    this.mixer.stopAllAction();
    this.animations[this.animationsStatus[this.status]].play();
  }

  changeStatus(status) {
    if (this.status === status || !this.statuses.includes(status)) return;
    this.status = status;
    this.playAnimation();
  }
}

const initScene = () => {
  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0a0a0);
  scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(-3, 10, -10);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 2;
  dirLight.shadow.camera.bottom = -2;
  dirLight.shadow.camera.left = -2;
  dirLight.shadow.camera.right = 2;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 40;
  scene.add(dirLight);
};

const initCamera = () => {
  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.001,
    1000
  );
  const x = 1;
  const y = 2;
  const z = 1;
  camera.position.set(x, y, z);
  // camera.lookAt(2, -1, 0);
};

const initRenderer = (container) => {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);
};

const initPhysics = () => {
  // 初始化 Ammo.js
  let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  let dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  let overlappingPairCache = new Ammo.btDbvtBroadphase();
  let solver = new Ammo.btSequentialImpulseConstraintSolver();
  dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    overlappingPairCache,
    solver,
    collisionConfiguration
  );
  // 设置重力
  let gravity = new Ammo.btVector3(0, -0.5, 0);
  dynamicsWorld.setGravity(gravity);

  // 创建平面
  // const groundShape = new Ammo.btStaticPlaneShape(
  //   new Ammo.btVector3(0, 1, 0),
  //   0
  // );
  // const groundTransform = new Ammo.btTransform();
  // groundTransform.setIdentity();
  // groundTransform.setOrigin(new Ammo.btVector3(0, 0, 0));
  // const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
  // const groundRigidBodyInfo = new Ammo.btRigidBodyConstructionInfo(
  //   0,
  //   groundMotionState,
  //   groundShape,
  //   new Ammo.btVector3(0, 0, 0)
  // );
  // const groundRigidBody = new Ammo.btRigidBody(groundRigidBodyInfo);
  // dynamicsWorld.addRigidBody(groundRigidBody);
};

const loadModal = () => {
  // const mesh = new THREE.Mesh(
  //   new THREE.PlaneGeometry(100, 100),
  //   new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  // );
  // mesh.rotation.x = -Math.PI / 2;
  // mesh.receiveShadow = true;
  // scene.add(mesh);

  const loader = new GLTFLoader();
  loader.load(
    "src/assets/models/vr_gallery_house_baked.glb",
    function (gltf) {
      homeModel = gltf.scene;
      createRigidBodies(homeModel, false);
      homeModel.scale.set(1, 1, 1);
      scene.add(homeModel);
      homeMixer = new THREE.AnimationMixer(homeModel);
      homeMixer.clipAction(gltf.animations[0]).play();

      homeModel.traverse(function (object) {
        if (object.isMesh) object.castShadow = true;
      });

      createTest();

      animate();
    },
    function (xhr) {
      // console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    }
  );

  loader.load("src/assets/models/Soldier.glb", function (gltf) {
    model = gltf.scene;
    scene.add(model);
    createRigidBodies(model, true);
    model.scale.set(0.8, 0.8, 0.8);
    model.position.y = 1;

    // 动画混合器
    modelMixer = new THREE.AnimationMixer(model);
    modelMixer.clipAction(gltf.animations[1]).play();
    const actions = gltf.animations.map((item) => {
      return modelMixer.clipAction(item);
    });
    const animations = {
      idle: actions[0],
      Run: actions[1],
      TPose: actions[2],
      Walk: actions[3],
    };
    moveState = new MoveState(modelMixer, animations);

    model.traverse(function (object) {
      if (object.isMesh) object.castShadow = true;
    });
  });
};

// 刚体数组
const rigidNodes = [];
const nodeTransfroms = [];

function createRigidBodies(node, shouldMass) {
  if (node.isMesh) {
    // console.log(node.name, node, "node======");
    // eslint-disable-next-line no-debugger
    // 创建刚体
    let bufferGeometry = node.geometry;
    let positionAttr = bufferGeometry.getAttribute("position");
    let vertices = [];
    for (let i = 0; i < positionAttr.count; i++) {
      let x = positionAttr.getX(i);
      let y = positionAttr.getY(i);
      let z = positionAttr.getZ(i);
      vertices.push(new Ammo.btVector3(x, y, z));
    }
    let indices = [];
    let indexAttr = bufferGeometry.getIndex();
    for (let i = 0; i < indexAttr.count; i += 3) {
      indices.push(
        indexAttr.getX(i),
        indexAttr.getX(i + 1),
        indexAttr.getX(i + 2)
      );
    }
    let shape = new Ammo.btConvexHullShape();
    shape.setMargin(0);
    for (let i = 0; i < vertices.length; i++) {
      shape.addPoint(vertices[i]);
    }
    let mass = 0;
    if (shouldMass) {
      console.log(node, "------------------");
      mass = 10;
    }
    let localInertia = new Ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);
    const nodeTransfrom = new Ammo.btTransform(
      new Ammo.btQuaternion(0, 0, 0, 1),
      new Ammo.btVector3(0, 0, 0)
    );
    nodeTransfrom.setIdentity();
    let motionState = new Ammo.btDefaultMotionState(nodeTransfrom);
    let rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia
    );
    let body = new Ammo.btRigidBody(rbInfo);
    // if (shouldMass) {
    const origin = nodeTransfrom.getOrigin();
    origin.setX(0);
    origin.setY(0);
    origin.setZ(0);
    body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    // }
    rigidNodes.push(node);
    node.userData.physicsBody = body;
    nodeTransfroms.push(nodeTransfrom);
    dynamicsWorld.addRigidBody(body);
    return;
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      createRigidBodies(node.children[i], shouldMass);
    }
  }
}

function createRigidBody(mesh, shape, mass) {
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(
    new Ammo.btVector3(mesh.position.x, mesh.position.y, mesh.position.z)
  );
  transform.setRotation(
    new Ammo.btQuaternion(
      mesh.quaternion.x,
      mesh.quaternion.y,
      mesh.quaternion.z,
      mesh.quaternion.w
    )
  );

  const motionState = new Ammo.btDefaultMotionState(transform);

  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    shape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  dynamicsWorld.addRigidBody(body);

  mesh.userData.physicsBody = body;

  return body;
}

let boxTransform = null;
let boxMesh = null;

function createTest() {
  // 创建立方体网格
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const boxMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
  boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
  console.log(boxMesh, "/////");

  // 将网格转换为 Ammo.js 的刚体
  const boxShape = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5));
  boxTransform = new Ammo.btTransform();
  boxTransform.setIdentity();
  const boxMass = 1;
  // const localInertia = new Ammo.btVector3(0, 0, 0);

  boxTransform.setIdentity();
  let origin = boxTransform.getOrigin();
  origin.setX(0);
  origin.setY(10);
  origin.setZ(0);
  let localInertia = new Ammo.btVector3(0, 0, 0);

  boxShape.calculateLocalInertia(boxMass, localInertia);
  let myMotionState = new Ammo.btDefaultMotionState(boxTransform);
  let rbInfo = new Ammo.btRigidBodyConstructionInfo(
    boxMass,
    myMotionState,
    boxShape,
    localInertia
  );
  rigidNodes.push(boxMesh);
  nodeTransfroms.push(boxTransform);
  let boxBody = new Ammo.btRigidBody(rbInfo);
  boxBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
  dynamicsWorld.addRigidBody(boxBody);
  boxMesh.userData.physicsBody = boxBody;

  // 将刚体添加到物理世界中
  dynamicsWorld.addRigidBody(boxBody);

  // 将网格添加到场景中
  scene.add(boxMesh);
}

const initControl = () => {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.target.set(0, 1, 0);
  controls.update();
};

// const updateDynamics = (deltaTime, mesh, transform) => {
//   dynamicsWorld.stepSimulation(deltaTime, 10);

//   const objPhys = mesh.userData.physicsBody;
//   const ms = objPhys.getMotionState();
//   if (ms) {
//     ms.getWorldTransform(transform);
//     const p = transform.getOrigin();
//     const q = transform.getRotation();
//     mesh.position.set(p.x(), p.y(), p.z());
//     mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
//   }
// };

function updatePhysics(deltaTime) {
  // Step world
  dynamicsWorld.stepSimulation(deltaTime, 10);

  // Update rigid bodies
  for (let i = 0, il = rigidNodes.length; i < il; i++) {
    const objThree = rigidNodes[i];

    const objPhys = objThree.userData.physicsBody;
    const ms = objPhys.getMotionState();
    const transfrom = nodeTransfroms[i];

    if (ms) {
      ms.getWorldTransform(transfrom);
      const p = transfrom.getOrigin();
      const q = transfrom.getRotation();
      // ms.getWorldTransform(transformAux1);
      // const p = transformAux1.getOrigin();
      // const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
      if (objThree.name === "vanguard_Mesh") {
        // console.log(p.x(), p.y(), p.z(), "three");
      }

      objThree.userData.collided = false;
    }
  }
}

const animate = () => {
  const deltaTime = clock.getDelta();

  // console.log(camera);
  requestAnimationFrame(animate);

  // updateDynamics(deltaTime, boxMesh, boxTransform);
  updatePhysics(deltaTime);

  // for (let i = 0; i < rigidNodes.length; i++) {
  //   // console.log(rigidNodes[i], nodeTransfroms[i]);
  //   updateDynamics(deltaTime, rigidNodes[i], nodeTransfroms[i]);
  // }

  // material.uniforms.iTime.value += 0.1;
  // renderer.render(scene, camera);

  homeMixer.update(deltaTime);
  modelMixer.update(deltaTime);

  renderer.render(scene, camera);
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
};

function initMovement() {
  document.addEventListener("keydown", keyMove);
  document.addEventListener("keyup", keyUp);

  // 步长
  const step = 0.1;

  function keyUp(ev) {
    if (moveState.getStatus() !== "jump") {
      moveState.changeStatus("stand");
    }
  }
  // 键盘监听
  function keyMove(ev) {
    if (moveState.getStatus() === "jump") return;
    switch (ev.keyCode) {
      case 65:
        moveState.changeStatus("left");
        moveBox();
        break;
      case 87:
        moveState.changeStatus("forward");
        moveBox();
        break;
      case 68:
        moveState.changeStatus("right");
        moveBox();
        break;
      case 83:
        moveState.changeStatus("back");
        moveBox();
        break;
      case 32:
        moveState.changeStatus("jump");
        // jump()
        break;
      default:
        return;
    }
  }

  // 跳跃
  // function jump() {
  //   // 跳跃的最大高度
  //   const max = 100
  //   // 初始高度
  //   const initY = model.position.y
  //   // 是否在下坠
  //   let down = false
  //   // 递增和递减系数
  //   let t = 1
  //   const x = 0.6
  //   // 跳跃
  //   let interval = setInterval(() => {
  //     const downNumber = down ? -1 : 1
  //     model.position.y += 3 * downNumber * t
  //     camera.position.y += 3 * downNumber * t
  //     t += downNumber * x
  //     // 到最高点开始下坠
  //     if (model.position.y >= max) {
  //       down = true
  //     }
  //     // 到最低点结束跳跃
  //     if (model.position.y <= initY && down) {
  //       model.position.y = initY
  //       moveState.changeStatus('stand')
  //       clearInterval(interval)
  //     }
  //     // setControl(...model.position)
  //   }, 30)
  // }

  // 移动物体
  function moveBox() {
    // 获取人物中心点和相机中心点
    const p1 = model.position;
    const p2 = camera.position;
    // 计算两者连接形成的向量
    const v1 = p1.clone().sub(p2);
    // 去掉y轴，变成xz的两位向量
    v1.y = 0;
    const length = v1.length();
    // 获取垂直向量
    const v2 = new THREE.Vector3(v1.z, 0, -v1.x);
    // 移动的方向
    let dir = 1;
    let v = v1;
    switch (moveState.getStatus()) {
      case "forward":
        dir = 1;
        break;
      case "left":
        dir = 1;
        v = v2;
        break;
      case "right":
        dir = -1;
        v = v2;
        break;
      case "back":
        dir = -1;
        break;
      default:
        return;
    }
    // 移动位置
    for (const key in v) {
      if (key === "y") continue;
      const temp = (dir * step * v[key]) / length;
      model.position[key] += temp;
      camera.position[key] += temp;
    }
    const { x, y, z } = model?.position || [];
    console.log(x, y, z);
    setControl(x, y, z);
  }
  // // 设置相机位置
  function setControl(x, y, z) {
    rotateModel();
    controls.target.set(x, y + 0.5, z);
    controls.update();
  }
  // // 选择人物方向
  function rotateModel() {
    // 获取人物中心点和相机中心点
    const p1 = model.position;
    const p2 = camera.position;
    // 计算两者连接形成的向量
    const v1 = p1.clone().sub(p2);
    v1.y = 0;
    // 人物的初始面向
    const origin = new THREE.Vector3(0, 0, 1);
    // 点乘求夹角
    const radian = Math.acos(v1.dot(origin) / (v1.length() * origin.length()));
    // 叉乘求方向
    console.log(v1.cross(origin));
    console.log(origin, v1, "=====");
    model.rotation.y = radian * (v1.z === 0 && 1 / v1.z < 0 ? -1 : 1);
  }
}

const createGLSL = () => {
  const vertexShader = `
  void main() {
    // 自定义顶点着色器代码
  }`;

  const fragmentShader = `
  uniform vec2 iResolution;
  uniform vec4 iMouse;
  uniform float iTime;

  void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 p = (fragCoord.xy / iResolution.xy) * 2.0 - 1.0;
    float time = iTime * 0.3;
    float r = length(p);
    float a = atan(p.y, p.x) + time;
    vec3 color = 0.5 + 0.5*cos(10.0*r + vec3(0.0, 2.0, 4.0)*a);
    fragColor = vec4(color, 1.0);
  }`;

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
};

const init = () => {
  const container = document.getElementById("home");

  // 初始化相机
  initCamera();

  // 初始化场景&灯光
  initScene();

  // 初始化物理世界
  initPhysics();

  // 加载模型
  loadModal();

  // 初始化渲染器
  initRenderer(container);

  // 初始化控制器
  initControl();

  // createGLSL();

  // 监听窗口调整大小
  // window.addEventListener("resize", onWindowResize);
};

onMounted(() => {
  init();
  initMovement();
});
</script>

<template>
  <div id="home"></div>
</template>

<style lang="scss" scoped>
#home {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
