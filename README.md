<p align="center">
  <img src="src-tauri/icons/icon.png" alt="eriri logo" width="200" />
</p>

<h1 align="center">eriri</h1>

<p align="center">
  <strong>A lovely, high-performance digital library for your favorite comics and books.</strong>
</p>

## 🛠️ Tech Stack

- **Frontend**: [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Backend**: [Tauri](https://tauri.app/), [Rust](https://www.rust-lang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19 or newer
- [Rustup](https://rustup.rs/) (the repository installs/pins Rust 1.96.0)
- [Corepack](https://nodejs.org/api/corepack.html) with pnpm 11.7.0

### Development

1.  **Clone the repository**:

    ```shell
    git clone https://github.com/chanshiyucx/eriri.git
    cd eriri
    ```

2.  **Install dependencies**:

    ```shell
    corepack enable
    pnpm install
    ```

3.  **Run the development server**:
    ```shell
    pnpm tauri dev
    ```

### Build

To create a production bundle:

```shell
pnpm tauri build --bundles app
```

## 📂 Project Structure

- `src/`: React frontend source code.
- `src-tauri/`: Rust backend and Tauri configuration.
- `public/`: Static assets.

## 📜 License

Distributed under the MIT License.
