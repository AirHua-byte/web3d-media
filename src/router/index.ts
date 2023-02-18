import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import TestCompVue from "../components/TestComp.vue";
import SkinBlendVue from "../components/SkinBlend.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "home",
    component: SkinBlendVue,
  },
  {
    path: "/test",
    name: "TestCompVue",
    component: TestCompVue,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
