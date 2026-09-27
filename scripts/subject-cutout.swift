import AppKit
import CoreImage
import Foundation
import Vision

if CommandLine.arguments.count < 3 {
    fputs("Usage: subject-cutout.swift input output.png\n", stderr)
    exit(2)
}

let inputPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]

func fail(_ message: String) -> Never {
    fputs(message + "\n", stderr)
    exit(1)
}

guard let source = NSImage(contentsOfFile: inputPath)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fail("Could not read the photo.")
}

let prepared = resized(source, maxEdge: 2400)

do {
    let cut = try selectSubject(prepared)
    let rep = NSBitmapImageRep(cgImage: cut)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        fail("Could not save the cutout.")
    }
    try data.write(to: URL(fileURLWithPath: outputPath))
} catch {
    fail(error.localizedDescription)
}

func resized(_ image: CGImage, maxEdge: Int) -> CGImage {
    let longest = max(image.width, image.height)
    if longest <= maxEdge { return image }
    let scale = CGFloat(maxEdge) / CGFloat(longest)
    let width = max(1, Int((CGFloat(image.width) * scale).rounded()))
    let height = max(1, Int((CGFloat(image.height) * scale).rounded()))
    guard let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return image }
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return ctx.makeImage() ?? image
}

func selectSubject(_ image: CGImage) throws -> CGImage {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
    try handler.perform([request])
    guard let observation = request.results?.first else {
        throw NSError(domain: "subject", code: 2, userInfo: [NSLocalizedDescriptionKey: "No person was found in this photo."])
    }
    let maskBuffer = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)
    let input = CIImage(cgImage: image)
    var mask = CIImage(cvPixelBuffer: maskBuffer)
    if mask.extent.width > 1, mask.extent.height > 1, input.extent.width > 1 {
        mask = mask.transformed(by: CGAffineTransform(
            scaleX: input.extent.width / mask.extent.width,
            y: input.extent.height / mask.extent.height
        )).cropped(to: input.extent)
    }
    let tightened = mask
        .clampedToExtent()
        .applyingGaussianBlur(sigma: 0.7)
        .cropped(to: input.extent)
        .applyingFilter("CIColorControls", parameters: [
            kCIInputSaturationKey: 0,
            kCIInputBrightnessKey: -0.03,
            kCIInputContrastKey: 1.4,
        ])
        .cropped(to: input.extent)
    let clear = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0)).cropped(to: input.extent)
    let blended = input.applyingFilter("CIBlendWithMask", parameters: [
        kCIInputBackgroundImageKey: clear,
        kCIInputMaskImageKey: tightened,
    ])
    let context = CIContext(options: [.workingColorSpace: NSNull()])
    guard let rendered = context.createCGImage(blended, from: input.extent) else {
        throw NSError(domain: "subject", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not render the cutout."])
    }
    return try despill(rendered)
}

func despill(_ image: CGImage) throws -> CGImage {
    let width = image.width
    let height = image.height
    let bytesPerRow = width * 4
    var pixels = readPixels(image, width: width, height: height, bytesPerRow: bytesPerRow)
    var opaque = 0
    for index in stride(from: 3, to: pixels.count, by: 4) where pixels[index] > 40 {
        opaque += 1
    }
    if opaque < max(80, (width * height) / 80) {
        throw NSError(domain: "subject", code: 2, userInfo: [NSLocalizedDescriptionKey: "No person was found in this photo."])
    }

    let original = pixels
    for y in 0..<height {
        for x in 0..<width {
            let offset = (y * bytesPerRow) + (x * 4)
            let alpha = Int(original[offset + 3])
            if alpha < 18 || alpha > 235 { continue }
            guard let color = interiorColor(original, bytesPerRow: bytesPerRow, width: width, height: height, x: x, y: y) else { continue }
            let a = Float(alpha) / 255
            pixels[offset] = UInt8(min(255, color.0 * a))
            pixels[offset + 1] = UInt8(min(255, color.1 * a))
            pixels[offset + 2] = UInt8(min(255, color.2 * a))
        }
    }

    guard let out = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )?.makeImage() else { return image }
    return out
}

func readPixels(_ image: CGImage, width: Int, height: Int, bytesPerRow: Int) -> [UInt8] {
    var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
    guard let ctx = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return pixels }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return pixels
}

func interiorColor(_ pixels: [UInt8], bytesPerRow: Int, width: Int, height: Int, x: Int, y: Int) -> (Float, Float, Float)? {
    for radius in 1...10 {
        for step in 0..<8 {
            let angle = Float(step) / 8 * 2 * .pi
            let sx = x + Int((cos(angle) * Float(radius)).rounded())
            let sy = y + Int((sin(angle) * Float(radius)).rounded())
            if sx < 0 || sy < 0 || sx >= width || sy >= height { continue }
            let offset = (sy * bytesPerRow) + (sx * 4)
            let alpha = Float(pixels[offset + 3]) / 255
            if alpha < 0.9 { continue }
            return (Float(pixels[offset]) / alpha, Float(pixels[offset + 1]) / alpha, Float(pixels[offset + 2]) / alpha)
        }
    }
    return nil
}
