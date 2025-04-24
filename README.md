# Project-4-Lost

## Project Summary

We aim to develop an intelligent route planning and scheduling system for delivery agents that optimizes delivery routes while considering multiple real-world constraints. The system will handle time windows, traffic conditions, and multiple delivery locations to minimize travel time and maximize delivery efficiency. We will use A* algorithm to find the optimal route when regarding all these possible factors. For simulating the road network, we will use Google OR-Tools to model the network and Solomon VRPTW Benchmark Solutions to test the network in different scheduling windows and traffic conditions. 

---

Team Members & Roles 

Chance: Project Manager 

Cade: Algorithm Developer  

Spencer: System Tester 

Ritvik: UI Designer 

Jonathan: Algorithm Developer 

Shenghao: Road Network Developer 

---

## Installation

### Prerequisites

Make sure the following tools are installed before proceeding:
- [Git](https://git-scm.com/) – to clone the repository
- [Node.js](https://nodejs.org/) (v18+ recommended)
- `npm` – comes with Node.js

---

### Installation Steps

Follow these steps to run the pathfinder locally:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/project-4-lost.git
cd project-4-lost

# 2. Run the program
npm install
npm run dev

#3 Go to http://localhost:3000/
