import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Agents } from "./pages/Agents";
import { Tools } from "./pages/Tools";
import { Records } from "./pages/Records";
import { Inference } from "./pages/Inference";
import { Voice } from "./pages/Voice";

export const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="tools" element={<Tools />} />
        <Route path="records" element={<Records />} />
        <Route path="inference" element={<Inference />} />
        <Route path="voice" element={<Voice />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
