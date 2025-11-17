import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import './App.css';
import Home from './pages/Home.jsx';
import LogIn from './pages/LogIn.jsx';
import CreateClub from './pages/CreateClub.jsx';
import ClubPage from './pages/ClubPage.jsx';
import JoinClub from './pages/JoinClub.jsx';
import Comment from './pages/Comment.jsx';
import CreateEvent from './pages/CreateEvent.jsx';

// ---> UPDATE: ClubPage/:clubName->:clubName ; Comment/:clubName-> :clubName/Comment ... <---

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
          <Route path="/Comment/:clubName" element={<Comment/>} />
          <Route path="/CreateEvent/:clubName" element={<CreateEvent/>} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
