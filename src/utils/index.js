import path from 'path'

// 判断是否为图片
const ext = ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
export const isImg = url => ext.includes(path.extname(url))
