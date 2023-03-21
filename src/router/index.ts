import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import TestCompVue from "../components/TestComp.vue";
import SkinBlendVue from "../components/SkinBlend.vue";
import HomePageVue from "../components/HomePage.vue";
import TestAmmoVue from "../components/TestAmmo.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "index",
    component: SkinBlendVue,
  },
  {
    path: "/test",
    name: "TestCompVue",
    component: TestCompVue,
  },
  {
    path: "/home",
    name: "home",
    component: HomePageVue,
  },
  {
    path: "/ammo",
    name: "ammo",
    component: TestAmmoVue,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
