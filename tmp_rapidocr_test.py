from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
result = ocr('attached_assets/image_1745971135904.png')
print('type result', type(result))
for idx, item in enumerate(result):
    print(idx, type(item))
    if isinstance(item, list):
        print('first item', item[:3])
