import AppKit
import CoreImage
import Foundation
import Vision

let sourceDir = "/Users/mvinoth/.cursor/projects/Users-mvinoth-Documents-azent-template-generator/assets"
let outDir = "/Users/mvinoth/Documents/azent-template-generator/public/assets/photos/just-married"
try FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let liftSource = "\(sourceDir)/DSC04140-647310be-fdc1-4696-b5cc-0b94d8e1326b.jpg"
let groomSource = "\(sourceDir)/DSC04034-3841ce40-a8c4-4f7d-beb9-a509b0191808.jpg"
let stairsSource = "\(sourceDir)/DSC04162-df1824f4-45c2-4e5f-969b-f3cfd1f083f2.jpg"
let pillarSource = "\(sourceDir)/DSC04041-41fe4de9-c332-4659-8597-b805535c1c49.jpg"

func loadCGImage(_ path: String) throws -> CGImage {
    guard let image = NSImage(contentsOfFile: path),
          let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        throw NSError(domain: "just-married", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not read \(path)"])
    }
    return cg
}

func cutout(_ image: CGImage) throws -> CGImage {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
    try handler.perform([request])
    guard let observation = request.results?.first else {
        throw NSError(domain: "just-married", code: 2, userInfo: [NSLocalizedDescriptionKey: "No person found"])
    }
    let maskBuffer = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)
    let input = CIImage(cgImage: image)
    var mask = CIImage(cvPixelBuffer: maskBuffer)
    if mask.extent.width > 1, mask.extent.height > 1 {
        let scaleX = input.extent.width / mask.extent.width
        let scaleY = input.extent.height / mask.extent.height
        mask = mask.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY)).cropped(to: input.extent)
    }
    let clear = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0)).cropped(to: input.extent)
    let blended = input.applyingFilter("CIBlendWithMask", parameters: [
        kCIInputBackgroundImageKey: clear,
        kCIInputMaskImageKey: mask,
    ])
    let context = CIContext(options: [.workingColorSpace: NSNull()])
    guard let rendered = context.createCGImage(blended, from: input.extent) else {
        throw NSError(domain: "just-married", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not render cutout"])
    }
    return cropToSubject(rendered, padding: 8)
}

func cropToSubject(_ image: CGImage, padding: Int) -> CGImage {
    let width = image.width
    let height = image.height
    let bytesPerRow = width * 4
    var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
    guard let ctx = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return image }
    ctx.translateBy(x: 0, y: CGFloat(height))
    ctx.scaleBy(x: 1, y: -1)
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    var minX = width
    var minY = height
    var maxX = 0
    var maxY = 0
    var found = false
    for y in 0..<height {
        for x in 0..<width {
            let alpha = pixels[(y * bytesPerRow) + (x * 4) + 3]
            if alpha < 16 { continue }
            found = true
            if x < minX { minX = x }
            if y < minY { minY = y }
            if x > maxX { maxX = x }
            if y > maxY { maxY = y }
        }
    }
    guard found else { return image }
    let crop = CGRect(
        x: max(0, minX - padding),
        y: max(0, minY - padding),
        width: min(width - 1, maxX + padding) - max(0, minX - padding) + 1,
        height: min(height - 1, maxY + padding) - max(0, minY - padding) + 1
    )
    return image.cropping(to: crop) ?? image
}

func writePNG(_ image: CGImage, to path: String) throws {
    let rep = NSBitmapImageRep(cgImage: image)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "just-married", code: 4, userInfo: [NSLocalizedDescriptionKey: "PNG encode failed"])
    }
    try data.write(to: URL(fileURLWithPath: path))
    print("cutout \(path) \(image.width)x\(image.height)")
}

func copyJPEG(_ source: String, to path: String) throws {
    if FileManager.default.fileExists(atPath: path) {
        try FileManager.default.removeItem(atPath: path)
    }
    try FileManager.default.copyItem(atPath: source, toPath: path)
    print("copied \(path)")
}

func drawBackground(to path: String) throws {
    let width = 3600
    let height = 1200
    guard let ctx = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return }
    ctx.translateBy(x: 0, y: CGFloat(height))
    ctx.scaleBy(x: 1, y: -1)
    ctx.setFillColor(CGColor(red: 0.99, green: 0.95, blue: 0.91, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

    func curtain(from start: CGFloat, to end: CGFloat) {
        var x = start
        var index = 0
        while x < end {
            let fold = 140 + CGFloat(index % 3) * 50
            ctx.setFillColor(CGColor(red: 0.90, green: 0.82, blue: 0.76, alpha: 0.45))
            ctx.fill(CGRect(x: x, y: 0, width: fold * 0.38, height: CGFloat(height)))
            ctx.setFillColor(CGColor(red: 1, green: 0.98, blue: 0.95, alpha: 0.7))
            ctx.fill(CGRect(x: x + fold * 0.4, y: 0, width: fold * 0.34, height: CGFloat(height)))
            x += fold
            index += 1
        }
    }
    curtain(from: 0, to: 1500)
    curtain(from: 2100, to: CGFloat(width))

    ctx.setFillColor(CGColor(red: 0.98, green: 0.62, blue: 0.18, alpha: 1))
    ctx.fill(CGRect(x: 1180, y: 0, width: 1240, height: CGFloat(height)))
    for i in 0..<42 {
        let x = 1180 + CGFloat(i) * 30
        let warm = i % 2 == 0
        ctx.setFillColor(warm
            ? CGColor(red: 0.92, green: 0.38, blue: 0.08, alpha: 0.38)
            : CGColor(red: 1, green: 0.82, blue: 0.35, alpha: 0.34))
        ctx.fill(CGRect(x: x, y: 0, width: warm ? 14 : 8, height: CGFloat(height)))
    }

    guard let sharp = ctx.makeImage() else { return }
    let blurred = CIImage(cgImage: sharp)
        .clampedToExtent()
        .applyingGaussianBlur(sigma: 42)
        .cropped(to: CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    let ciContext = CIContext(options: nil)
    guard let soft = ciContext.createCGImage(blurred, from: blurred.extent) else { return }
    let rep = NSBitmapImageRep(cgImage: soft)
    let props: [NSBitmapImageRep.PropertyKey: Any] = [.compressionFactor: 0.9]
    guard let data = rep.representation(using: .jpeg, properties: props) else { return }
    try data.write(to: URL(fileURLWithPath: path))
    print("background \(path) \(width)x\(height)")
}

let lift = try cutout(try loadCGImage(liftSource))
try writePNG(lift, to: "\(outDir)/lift.png")
let groom = try cutout(try loadCGImage(groomSource))
try writePNG(groom, to: "\(outDir)/groom.png")
try copyJPEG(stairsSource, to: "\(outDir)/stairs.jpg")
try copyJPEG(pillarSource, to: "\(outDir)/pillar.jpg")
try drawBackground(to: "\(outDir)/background.jpg")
