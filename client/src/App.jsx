import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './App.css';
import Home from './pages/Home.jsx';
import LogIn from './pages/LogIn.jsx';
import CreateClub from './pages/CreateClub.jsx';
import ClubPage from './pages/ClubPage.jsx';
import JoinClub from './pages/JoinClub.jsx';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/LogIn" element={<LogIn/>} />
          <Route path="/CreateClub" element={<CreateClub/>} />
          <Route path="/ClubPage/:clubName" element={<ClubPage/>} />
          <Route path="/JoinClub/:clubName" element={<JoinClub/>} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
