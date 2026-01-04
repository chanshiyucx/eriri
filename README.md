<p align="center">
  <img src="src-tauri/icons/icon.png" alt="eriri logo" width="200" />
</p>

<h1 align="center">eriri</h1>

<p align="center">
  <strong>A lovely, high-performance digital library for your favorite comics, books, and videos.</strong>
</p>

## 🛠️ Tech Stack

- **Frontend**: [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Backend**: [Tauri](https://tauri.app/), [Rust](https://www.rust-lang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [pnpm](https://pnpm.io/installation)

### Development

1.  **Clone the repository**:

    ```shell
    git clone https://github.com/chanshiyucx/eriri.git
    cd eriri
    ```

2.  **Install dependencies**:

    ```shell
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
- `src-tauri/swift/`: Native Swift components for macOS.
- `public/`: Static assets.

## 📜 License

Distributed under the MIT License.
