import Foundation
import ImageIO

guard CommandLine.arguments.count == 5 else {
  fputs("Usage: swift check-meta-imageio.swift image make model yyyy:mm:dd hh:mm:ss\n", stderr)
  exit(2)
}
let args = CommandLine.arguments
let imageURL = URL(fileURLWithPath: args[1])
guard let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any]
else {
  fputs("IMAGEIO_UNABLE_TO_READ_IMAGE\n", stderr)
  exit(3)
}
let tiff = properties[kCGImagePropertyTIFFDictionary as String] as? [String: Any] ?? [:]
let exif = properties[kCGImagePropertyExifDictionary as String] as? [String: Any] ?? [:]
let make = tiff[kCGImagePropertyTIFFMake as String] as? String ?? ""
let model = tiff[kCGImagePropertyTIFFModel as String] as? String ?? ""
let dateTaken = exif[kCGImagePropertyExifDateTimeOriginal as String] as? String ?? ""
guard make == args[2], model == args[3], dateTaken == args[4] else {
  fputs("IMAGEIO_META_MISMATCH make=\(make) model=\(model) date=\(dateTaken)\n", stderr)
  exit(4)
}
print("IMAGEIO_EXIF_VERIFIED")
