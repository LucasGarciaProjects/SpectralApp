# SpectralApp

SpectralApp is an interactive web application for **functional spectral data analysis and modeling**, designed to make Functional Data Analysis (FDA) accessible to researchers without requiring programming skills.

The platform provides a complete pipeline for spectral datasets, from data preprocessing and functional representation to exploratory analysis, dimensionality reduction, and predictive modeling — all within a single intuitive interface.

This project was developed as my **Bachelor’s Thesis in Data Science and Engineering at Universidad Carlos III de Madrid**, supervised by **Prof. Aldo Luis Moreno Oyervides (Spectroscopy Department)**.

---

## Project Overview

Spectral datasets are widely used in fields such as:

- chemistry and spectroscopy
- biomedical diagnostics
- industrial process monitoring
- agriculture and environmental analysis

However, most advanced analysis tools require **programming knowledge in R or Python**, which creates a barrier for many scientists.

SpectralApp addresses this gap by providing a **modular, code-free platform** that allows users to:

- upload spectral datasets
- transform discrete measurements into functional representations
- explore patterns and variability
- apply dimensionality reduction techniques
- train predictive models
- export results for reproducible research

The application integrates **Functional Data Analysis techniques** with modern web technologies to create a practical tool for research and education.

---

## Key Features

### Interactive Data Upload & Validation
- Import spectral datasets in **CSV or TXT format**
- Automatic detection of:
  - headers
  - decimal separators
  - column separators
- Dataset preview and validation before analysis
- Configurable spectral domain (e.g., wavelength ranges)

### Functional Data Representation
Discrete spectral measurements are transformed into **continuous functional objects** using basis expansion methods:

- B-splines
- Fourier basis
- Wavelet basis

Additional capabilities include:

- smoothing parameter selection
- automatic **Generalized Cross Validation (GCV)**
- visualization of original vs smoothed curves
- residual inspection

Users can **store up to 5 functionalized datasets**, each with its own metadata.

### Exploratory Functional Analysis

The platform provides descriptive tools to understand spectral variability:

- mean function with confidence bands
- variance across the domain
- correlation analysis between spectral regions

These tools help identify relevant spectral patterns before modeling.

### Unsupervised Learning (FPCA)

SpectralApp implements **Functional Principal Component Analysis (FPCA)** for dimensionality reduction.

Features include:

- explained variance visualization
- principal component functions
- interactive scores plots
- linked curve visualization
- varimax rotation for interpretability
- signal reconstruction using selected components

Users can interactively explore how spectral curves relate to principal components.

### Supervised Functional Modeling

The platform supports several FDA-based predictive models:

- Scalar-on-Function Regression (SoFR)
- Function-on-Scalar Regression (FoSR)
- Function-on-Function Regression (FoFR)
- Functional Principal Component Regression (FPCR)
- Functional Principal Component Logistic Regression (FPCLoR)
- Functional Linear Discriminant Analysis (FLDA)

Outputs include:

- fitted values and residuals
- model summaries and diagnostics
- functional parameter estimates β(t)
- classification metrics such as ROC curves and confusion matrices

### Reproducibility and Export

SpectralApp allows exporting results at every stage:

- functional datasets
- FPCA scores and loadings
- model outputs
- plots and visualizations

Supported formats include:

- CSV
- JSON
- PNG
- SVG
- interactive HTML plots

This ensures **reproducibility and easy integration into scientific reports or publications**.

---

## Application Workflow

The analysis pipeline follows a structured workflow:

1. Upload spectral dataset
2. Validate and configure domain
3. Functionalize data using basis expansions
4. Perform exploratory analysis
5. Apply unsupervised methods (FPCA)
6. Train supervised models
7. Export results and visualizations

This step-by-step design ensures that users always follow a **valid and reproducible analysis process**.

---

## Architecture

The platform follows a **three-layer architecture** combining modern web technologies with scientific computing.

### Frontend
- Next.js
- React
- TypeScript
- TailwindCSS
- Plotly.js for interactive visualizations

### Middleware / API
- Next.js API Routes (Node.js)
- Handles validation, file management and communication between frontend and backend

### Computational Backend
- Python
- scikit-fda
- NumPy
- Pandas

Python performs all Functional Data Analysis computations while the frontend provides a responsive and interactive user experience.

---

## Technology Stack

Frontend
- Next.js
- React
- TypeScript
- TailwindCSS
- Plotly.js

Backend
- Python
- scikit-fda
- NumPy
- Pandas

Architecture
- Hybrid Node.js + Python pipeline

---

## Running the Project

### 1. Clone the repository

```bash
git clone https://github.com/LucasGarciaProjects/SpectralApp.git
cd SpectralApp
2. Install frontend dependencies
npm install
3. Install Python dependencies

Create a virtual environment and install the required packages.

pip install -r requirements.txt
4. Start the development server
npm run dev

The application will be available at:

http://localhost:3000
Academic Context

This project was developed as the Bachelor's Final Thesis for the degree:

BSc in Data Science and Engineering
Universidad Carlos III de Madrid

Supervisor:
Dr. Aldo Luis Moreno Oyervides
Spectroscopy Department

The goal of the project was to demonstrate that Functional Data Analysis tools can be integrated into an accessible web platform capable of supporting complete spectral analysis workflows.

Future Improvements

Possible extensions include:

deployment as a cloud-based application

integration of additional FDA methods

deep learning models for spectral prediction

independent component analysis

larger dataset support and performance optimization

License



Full thesis available in /docs

This project is part of an academic thesis and is shared for educational and research purposes.
