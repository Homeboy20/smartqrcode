# Smart QR Code & Barcode Generator

A web application that allows users to generate QR codes and barcodes with customizable options. Built with Next.js, React, and Tailwind CSS.

![Smart QR Code & Barcode Generator](https://github.com/yourusername/smartqrcode/assets/screenshot.png)

## Live Demo

Add your deployed URL here.

## Features

- **QR Code Generation**: Create QR codes for URLs, text, contact information, and more
- **Barcode Generation**: Generate barcodes in various formats (CODE128, UPC, EAN, etc.)
- **Customization Options**: Modify colors, size, and other parameters
- **High-Quality Downloads**: Save generated codes as PNG images
- **No Registration Required**: Free to use without creating an account
- **Responsive Design**: Works on desktop and mobile devices

## Technologies Used

- **Next.js**: React framework for server-rendered applications
- **React**: JavaScript library for building user interfaces
- **TypeScript**: Typed JavaScript for better development experience
- **Tailwind CSS**: Utility-first CSS framework
- **qrcode & react-qr-code**: Libraries for QR code generation
- **jsbarcode**: Library for barcode generation

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/smartqrcode.git
   cd smartqrcode
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application

## Deployment

This project is intended to run as a standard Next.js server application (Node.js) so App Router API routes under `/api/*` work correctly.

- Build: `npm run build`
- Start: `npm start`

If you deploy to a container platform (e.g., Coolify), make sure your service actually runs the Next server and that `/api/health` returns JSON.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- [qrcode](https://github.com/soldair/node-qrcode) for QR code generation
- [react-qr-code](https://github.com/rosskhanas/react-qr-code) for React QR code component
- [jsbarcode](https://github.com/lindell/JsBarcode) for barcode generation
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Next.js](https://nextjs.org/) for the framework

## Build Requirements

This project has specific requirements for successful builds:

- **Node.js Version**: Requires Node.js v18.x - v21.x. Using versions outside this range may cause build failures.
- **Firebase Configuration**: All required Firebase environment variables must be properly set.
- **Environment Variables**: The application expects certain environment variables to be defined in `.env.local` or in your deployment environment.

### Troubleshooting Build Failures

If you encounter build errors, check the following:

1. **Node.js Version**: Run `node -v` to verify you're using a compatible Node.js version (v18-v21 recommended).
2. **Missing Environment Variables**: Make sure all required environment variables are defined.
3. **Firebase Initialization**: The app uses Firebase services that require proper configuration.

For production builds, make sure your deployment environment is configured with:
- The correct Node.js version (set in `.nvmrc`)
- All required environment variables
