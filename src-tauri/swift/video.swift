import AVFoundation
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
    print("Error: Input file does not exist at \(inputPath)")
    exit(1)
}

let asset = AVURLAsset(url: inputURL)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true 

let time = CMTime(seconds: 0, preferredTimescale: 600)

do {
    let (cgImage, _) = try await generator.image(at: time)
    let bitmapRep = NSBitmapImageRep(cgImage: cgImage)
    
    if let jpegData = bitmapRep.representation(using: .jpeg, properties: [.compressionFactor: 0.7]) {
        try jpegData.write(to: outputURL)
        exit(0)
    } else {
        print("Error: Failed to create JPEG representation")
        exit(1)
    }
} catch {
    print("Error: \(error.localizedDescription)")
    exit(1)
}
