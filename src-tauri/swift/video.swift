import Foundation
import QuickLookThumbnailing
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("Usage: thumb-gen <input_video_path> <output_image_path>")
    exit(1)
}

let inputPath = args[1]
let outputPath = args[2]
let inputURL = URL(fileURLWithPath: inputPath)
let outputURL = URL(fileURLWithPath: outputPath)

if !FileManager.default.fileExists(atPath: inputPath) {
    print("Error: Input file does not exist")
    exit(1)
}

let size = CGSize(width: 512, height: 512)
let scale = 1.0 

let request = QLThumbnailGenerator.Request(
    fileAt: inputURL,
    size: size,
    scale: scale,
    representationTypes: .thumbnail
)

let generator = QLThumbnailGenerator.shared
let semaphore = DispatchSemaphore(value: 0)

generator.generateBestRepresentation(for: request) { (thumbnail, error) in
    if let error = error {
        print("Error generating thumbnail: \(error.localizedDescription)")
        exit(1)
    }
    
    guard let thumb = thumbnail else {
        print("Error: No thumbnail generated")
        exit(1)
    }
    
    let nsImage = thumb.nsImage
    
    if let tiff = nsImage.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let jpgData = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.8]) {
        
        do {
            try jpgData.write(to: outputURL)
        } catch {
            print("Error writing file: \(error)")
            exit(1)
        }
    } else {
        print("Error: Failed to convert image to JPEG")
        exit(1)
    }
    
    semaphore.signal() 
}

semaphore.wait()
exit(0)