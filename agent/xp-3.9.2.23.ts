/* eslint-disable sort-keys */
/* eslint-disable camelcase */
/* eslint-disable no-console */
/* eslint-disable no-undef */

/**
 * WeChat 3.9.2.23
 *  > Special thanks to: @cixingguangming55555 老张学技术
 * Credit: https://github.com/cixingguangming55555/wechat-bot
 */

// https://blog.csdn.net/iloveitvm/article/details/109119687  frida学习

// import http from 'http';

// const server = http.createServer((req, res) => {
//   res.writeHead(200, { 'Content-Type': 'text/plain' });
//   res.end('Hello from Frida HTTP server!\n');
// });

// const port = 8001;
// server.listen(port, () => {
//   console.log(`Server listening on port ${port}...`);
// });

// 偏移地址,来自于wxhelper项目
import { wxOffsets_3_9_2_23 as wxOffsets } from './offset.js';

// 当前支持的微信版本
const availableVersion = 1661534743 // 3.9.2.23  ==0x63090217

const moduleBaseAddress = Module.getBaseAddress('WeChatWin.dll')
const moduleLoad = Module.load('WeChatWin.dll')
// console.info('moduleBaseAddress:', moduleBaseAddress)

/* -----------------base------------------------- */
let retidPtr: any = null
let retidStruct: any = null
const initidStruct = ((str: string | any[]) => {

  retidPtr = Memory.alloc(str.length * 2 + 1)
  retidPtr.writeUtf16String(str)

  retidStruct = Memory.alloc(0x14) // returns a NativePointer

  retidStruct
    .writePointer(retidPtr).add(0x04)
    .writeU32(str.length * 2).add(0x04)
    .writeU32(str.length * 2).add(0x04)
    .writeU32(0).add(0x04)
    .writeU32(0)

  return retidStruct
})

let retPtr: any = null
let retStruct: any = null
const initStruct = ((str: any) => {
  retPtr = Memory.alloc(str.length * 2 + 1)
  retPtr.writeUtf16String(str)

  retStruct = Memory.alloc(0x14) // returns a NativePointer

  retStruct
    .writePointer(retPtr).add(0x04)
    .writeU32(str.length * 2).add(0x04)
    .writeU32(str.length * 2).add(0x04)
    .writeU32(0).add(0x04)
    .writeU32(0)

  return retStruct
})

let msgstrPtr: any = null
let msgStruct: any = null
const initmsgStruct = (str: any) => {
  msgstrPtr = Memory.alloc(str.length * 2 + 1)
  msgstrPtr.writeUtf16String(str)

  msgStruct = Memory.alloc(0x14) // returns a NativePointer

  msgStruct
    .writePointer(msgstrPtr).add(0x04)
    .writeU32(str.length * 2).add(0x04)
    .writeU32(str.length * 2).add(0x04)
    .writeU32(0).add(0x04)
    .writeU32(0)

  return msgStruct
}

let atStruct: any = null
const initAtMsgStruct = (wxidStruct: any) => {
  atStruct = Memory.alloc(0x10)

  atStruct.writePointer(wxidStruct).add(0x04)
    .writeU32(wxidStruct.toInt32() + 0x14).add(0x04)// 0x14 = sizeof(wxid structure)
    .writeU32(wxidStruct.toInt32() + 0x14).add(0x04)
    .writeU32(0)
  return atStruct
}

const readStringPtr = (address: any) => {
  const addr: any = ptr(address)
  const size = addr.add(16).readU32()
  const capacity = addr.add(20).readU32()
  addr.ptr = addr
  addr.size = size
  addr.capacity = capacity
  if (capacity > 15 && !addr.readPointer().isNull()) {
    addr.ptr = addr.readPointer()
  }
  addr.ptr._readCString = addr.ptr.readCString
  addr.ptr._readAnsiString = addr.ptr.readAnsiString
  addr.ptr._readUtf8String = addr.ptr.readUtf8String
  addr.readCString = () => {
    return addr.size ? addr.ptr._readCString(addr.size) : ''
  }
  addr.readAnsiString = () => {
    return addr.size ? addr.ptr._readAnsiString(addr.size) : ''
  }
  addr.readUtf8String = () => {
    return addr.size ? addr.ptr._readUtf8String(addr.size) : ''
  }

  // console.info('readStringPtr() address:',address,' -> str ptr:', addr.ptr, 'size:', addr.size, 'capacity:', addr.capacity)
  // console.info('readStringPtr() str:' , addr.readUtf8String())
  // console.info('readStringPtr() address:', addr,'dump:', addr.readByteArray(24))

  return addr
}

const readWStringPtr = (address: any) => {
  const addr: any = ptr(address)
  const size = addr.add(4).readU32()
  const capacity = addr.add(8).readU32()
  addr.ptr = addr.readPointer()
  addr.size = size
  addr.capacity = capacity
  addr.ptr._readUtf16String = addr.ptr.readUtf16String
  addr.readUtf16String = () => {
    return addr.size ? addr.ptr._readUtf16String(addr.size * 2) : ''
  }

  // console.info('readWStringPtr() address:',address,' -> ptr:', addr.ptr, 'size:', addr.size, 'capacity:', addr.capacity)
  // console.info('readWStringPtr() str:' ,  `"${addr.readUtf16String()}"`,'\n',addr.ptr.readByteArray(addr.size*2+2),'\n')
  // console.info('readWStringPtr() address:', addr,'dump:', addr.readByteArray(16),'\n')

  return addr
}

const readString = (address: any) => {
  return readStringPtr(address).readUtf8String()
}

const readWideString = (address: any) => {
  return readWStringPtr(address).readUtf16String()
}

/* -----------------base------------------------- */

// 获取微信版本号
const getWechatVersionFunction = () => {
  const pattern = '55 8B ?? 83 ?? ?? A1 ?? ?? ?? ?? 83 ?? ?? 85 ?? 7F ?? 8D ?? ?? E8 ?? ?? ?? ?? 84 ?? 74 ?? 8B ?? ?? ?? 85 ?? 75 ?? E8 ?? ?? ?? ?? 0F ?? ?? 0D ?? ?? ?? ?? A3 ?? ?? ?? ?? A3 ?? ?? ?? ?? 8B ?? 5D C3'
  // 扫描内存，查找版本号
  const results: any = Memory.scanSync(moduleLoad.base, moduleLoad.size, pattern)
  console.info('getWechatVersionFunction results:', JSON.stringify(results, null, 2))
  if (results.length === 0) {
    return 0
  }
  const addr = results[0].address
  const ret = addr.add(0x07).readPointer()
  const ver = ret.add(0x0).readU32()
  return ver
}

// 获取微信版本号字符串
const getWechatVersionStringFunction = () => {
  const ver: number = getWechatVersionFunction()
  if (!ver) {
    return '0.0.0.0'
  }
  const vers: number[] = []
  vers.push((ver >> 24) & 255 - 0x60)
  vers.push((ver >> 16) & 255)
  vers.push((ver >> 8) & 255)
  vers.push(ver & 255)
  return vers.join('.')
}

console.info('WeChat Version:', getWechatVersionStringFunction())

// 检查微信版本是否支持
const checkSupportedFunction = () => {
  const ver = getWechatVersionFunction()
  return ver === availableVersion
}

// 检查是否已登录——done,2024-03-14，call和实现方法来源于ttttupup/wxhelper项目
const checkLogin = () => {
  let success = -1;
  const accout_service_addr = moduleBaseAddress.add(wxOffsets.login.WX_ACCOUNT_SERVICE_OFFSET);
  // 创建原生函数对象，此处假设该函数返回'pointer'并且不需要输入参数
  let getAccountService = new NativeFunction(accout_service_addr, 'pointer', []);
  // 调用原生函数并获取服务地址
  let service_addr = getAccountService();
  // 判断服务地址是否有效
  if (!service_addr.isNull()) {
    // 成功获取账户服务地址，现在访问0x4E0偏移的值
    // 注意：针对返回的地址，必须使用正确的类型，这里假设它是DWORD
    success = service_addr.add(0x4E0).readU32();
  }
  // 返回获得的状态值
  return success;
}

console.info('checkLogin:', checkLogin())

// 检查是否已登录
const isLoggedInFunction = () => {
  let success = -1
  const accout_service_addr = moduleBaseAddress.add(wxOffsets.login.WX_ACCOUNT_SERVICE_OFFSET)
  const callFunction = new NativeFunction(accout_service_addr, 'pointer', [])
  const service_addr = callFunction()
  // console.info('service_addr:', service_addr)

  try {
    if (!service_addr.isNull()) {
      const loginStatusAddress = service_addr.add(0x4E0)
      success = loginStatusAddress.readU32()
    }
  } catch (e: any) {
    throw new Error(e)
  }
  // console.info('isLoggedInFunction结果:', success)
  return success
}

// 登录事件回调,登陆状态下每3s检测一次，非登陆状态下不间断检测且每3s打印一次状态，直到登陆成功
const hookLoginEventCallback = (() => {
  const nativeCallback = new NativeCallback(() => { }, 'void', [])
  const nativeativeFunction = new NativeFunction(nativeCallback, 'void', [])
  Interceptor.attach(moduleBaseAddress.add(wxOffsets.login.WX_ACCOUNT_SERVICE_OFFSET), {
    onLeave: function (retval) {
      // console.info('hookLoginEventCallback:', retval)
      const isLoggedIn = isLoggedInFunction()
      if (isLoggedIn !== 1) {
        console.info('当前登陆状态:', isLoggedIn)
        setImmediate(() => nativeativeFunction())
      }
      return retval
    },
  })

  const checkLoginStatus = () => {
    const isLoggedIn = isLoggedInFunction()
    // console.info('当前登陆状态:', isLoggedIn);
    if (isLoggedIn !== 1) {
      setImmediate(() => nativeativeFunction())
      setTimeout(checkLoginStatus, 3000)  // 每3秒检查一次，直到登陆成功
    } else {
      setImmediate(() => nativeativeFunction())
    }
  }

  setTimeout(checkLoginStatus, 3000)  // 初始延迟3秒启动

  return nativeCallback
})()

// 登出事件回调
const hookLogoutEventCallback = (() => {
  const nativeCallback = new NativeCallback(() => { }, 'void', ['int32'])
  const nativeativeFunction = new NativeFunction(nativeCallback, 'void', ['int32'])

  try {
    Interceptor.attach(moduleBaseAddress.add(wxOffsets.login.WX_LOGOUT_OFFSET), {
      onEnter: function (args: any) {
        try {
          console.info('已登出:', args[0].toInt32())
          const bySrv = args[0].toInt32()
          setImmediate(() => nativeativeFunction(bySrv))
        } catch (e: any) {
          console.error('登出回调失败：', e)
          throw new Error(e)
        }
      },
    })
    return nativeCallback
  } catch (e) {
    console.error('登出回调失败：', e)
    return null
  }

})()

// 获取登录二维码
const getQrcodeLoginData = () => {
  const getQRCodeLoginMgr = new NativeFunction(moduleBaseAddress.add(wxOffsets.login.WX_LOGIN_URL_OFFSET), 'pointer', [])
  const qlMgr = getQRCodeLoginMgr()

  const json: any = {
    status: 0,
    uuid: '',
    wxid: '',
    avatarUrl: '',
  }

  if (!qlMgr.isNull()) {
    json.uuid = readString(qlMgr.add(8))
    json.status = qlMgr.add(40).readUInt()
    json.wxid = readString(qlMgr.add(44))
    json.avatarUrl = readString(qlMgr.add(92))
  }
  return json
}

let isReady = false
// 准备就绪回调
const agentReadyCallback = (() => {
  const nativeCallback = new NativeCallback(() => { }, 'void', [])
  const nativeativeFunction = new NativeFunction(nativeCallback, 'void', [])
  const checkLoginStatus = () => {
    const isLoggedIn = isLoggedInFunction()
    // console.info('当前登陆状态:', isLoggedIn);
    // 如果已经登陆则执行回调
    if (isLoggedIn === 1) {
      if (!isReady) {
        setImmediate(() => nativeativeFunction())
        isReady = true
      }
      setTimeout(checkLoginStatus, 3000)  // 每3秒检查一次，直到登陆成功

    }
  }

  setTimeout(checkLoginStatus, 3000)  // 初始延迟3秒启动
  return nativeCallback
})()

// 获取登录二维码(登录地址)
const getLoginUrlFunction = () => {
  const loginUrlAddr = moduleBaseAddress.add(wxOffsets.login.WX_LOGIN_URL_OFFSET).readPointer()
  const loginUrl = 'http://weixin.qq.com/x/' + loginUrlAddr.readUtf8String()
  return loginUrl
}

// 获取自己的信息
const getMyselfInfoFunction = () => {

  // const ptr = 0
  let wx_code: any = ''
  let wx_id: any = ''
  let wx_name: any = ''
  let head_img_url: any = ''

  const base = moduleBaseAddress.add(wxOffsets.myselfInfo.WX_SELF_ID_OFFSET)
  const wxid_len = base.add(0x4D4).readU32()

  if (wxid_len === 0x13) { // 新版本微信
    wx_id = base.readPointer().readAnsiString(wxid_len)
    wx_code = base.add(0x64).readAnsiString()
  } else {
    wx_id = readString(base)
    wx_code = wx_id
  }

  wx_name = readString(base.add(0x10C))
  const img_addr = base.add(0x2D8).readPointer()
  const img_len = base.add(0x2E8).readU32()

  head_img_url = img_addr.readAnsiString(img_len)

  const myself = {
    id: wx_id,
    code: wx_code,
    name: wx_name,
    head_img_url,
  }
  const myselfJson = JSON.stringify(myself)
  // console.info('myselfJson:', myselfJson)
  return myselfJson

}

console.info('getMyselfInfoFunction:', getMyselfInfoFunction())

class SelfInfoInner {
  wxid!: string
  account!: string
  mobile!: string
  signature!: string
  country!: string
  province!: string
  city!: string
  name!: string
  head_img!: string
  db_key!: string
  data_save_path!: string
  current_data_path!: string
}

// 获取联系人列表
const getContactNativeFunction = (): string => {
  // 基地址和偏移量需要根据目标程序实际情况调整
  // console.info('moduleBaseAddress:', moduleBaseAddress)
  const getInstanceAddr = moduleBaseAddress.add(
    wxOffsets.contactMgr.WX_CONTACT_MGR_OFFSET,
  );
  // console.info('getInstanceAddr:', getInstanceAddr)
  const contactGetListAddr = moduleBaseAddress.add(
    wxOffsets.contact.WX_CONTACT_GET_LIST_OFFSET,
  );

  // 准备用于存储联系人信息的数组
  const contacts: any[] = [];
  const contactPtr: any = Memory.alloc(Process.pointerSize * 3);
  contactPtr.writePointer(ptr(0));  // 初始化指针数组

  // 分配内存并编写汇编代码
  const asmCode = Memory.alloc(Process.pageSize);
  try {
    Memory.patchCode(asmCode, Process.pageSize, code => {
      const cw = new X86Writer(code, { pc: asmCode });

      // 模拟 C++ 中的内联汇编操作
      cw.putPushfx();
      cw.putPushax();
      // console.info('call getInstanceAddr:', getInstanceAddr)
      cw.putCallAddress(getInstanceAddr);
      // console.info('called getInstanceAddr:', getInstanceAddr)
      cw.putMovRegAddress('ecx', contactPtr);
      // console.info('putLeaRegAddress:', contactPtr)

      cw.putPushReg('ecx');
      // console.info('putPushReg:', 'ecx')
      cw.putMovRegReg('ecx', 'eax');
      // console.info('call contactGetListAddr:', contactGetListAddr)
      cw.putCallAddress(contactGetListAddr);
      cw.putXorRegReg('eax', 'eax'); // 将 EAX 寄存器清零
      cw.putMovRegReg('ecx', 'eax');

      cw.putPopax();
      cw.putPopfx();
      cw.putRet();

      cw.flush();
    });
  } catch (e) {
    console.error('Error during assembly code construction:', e);
    return '';
  }

  // 执行汇编代码
  let success = -1;
  try {
    const nativeFunction = new NativeFunction(asmCode, 'int', []);
    success = nativeFunction();
    // console.info('success:', success)
  } catch (e) {
    console.error('Error during function execution:', e);
    return '';
  }

  // 解析联系人信息
  if (success) {
    let start = contactPtr.readPointer();
    const end = contactPtr.add(Process.pointerSize * 2).readPointer();
    const CONTACT_SIZE = 0x438; // 假设每个联系人数据结构的大小

    while (start.compare(end) < 0) {
      const contact = {
        id: start.add(0x10).readPointer().readUtf16String(),
        custom_account: start.add(0x24).readPointer().readUtf16String(),
        del_flag: start.add(0x4c).readU32(),
        type: start.add(0x50).readU32(),
        verify_flag: start.add(0x54).readU32(),
        alias: start.add(0x58).readPointer().readUtf16String() || '', // 20字节
        name: start.add(0x6c).readPointer().readUtf16String(), // 64字节
        pinyin: start.add(0xAC).readPointer().readUtf16String(), // 20字节
        pinyin_all: start.add(0xC0).readPointer().readUtf16String(), // 20字节
      };

      // if(contact.alias){
      //   console.info('contact:', JSON.stringify(contact))
      // }

      if (contact.name) {
        contacts.push(contact);
      }
      start = start.add(CONTACT_SIZE);
    }
  }
  // console.info('contacts size:', contacts.length)
  const contactsString = JSON.stringify(contacts)
  // console.info('contacts:', contactsString)
  return contactsString;
};

// 设置联系人备注——done,2024-03-13，call和实现方法来源于ttttupup/wxhelper项目
const modifyContactRemarkFunction = (contactId: string, text: string) => {

  // int success = -1;
  const successPtr = Memory.alloc(4);
  successPtr.writeS32(-1)

  // WeChatString contact(wxid);
  const contactPtr: any = initidStruct(contactId);
  // WeChatString content(remark);
  const contentPtr: any = initStruct(text);
  // DWORD mod__addr = base_addr_ + WX_MOD_REMARK_OFFSET;
  const mod__addr = moduleBaseAddress.add(
    wxOffsets.contact.WX_MOD_REMARK_OFFSET,
  );

  const txtAsm: any = Memory.alloc(Process.pageSize)
  Memory.patchCode(txtAsm, Process.pageSize, code => {
    const writer = new X86Writer(code, {
      pc: txtAsm,
    })
    //     PUSHAD
    //     PUSHFD
    writer.putPushfx();
    writer.putPushax();
    //     LEA        EAX,content
    writer.putMovRegAddress('eax', contentPtr);
    //     PUSH       EAX
    writer.putPushReg('eax');
    //     LEA        EAX,contact
    writer.putMovRegAddress('eax', contactPtr);
    //     PUSH       EAX
    writer.putPushReg('eax');
    //     CALL       mod__addr   
    writer.putCallAddress(mod__addr);
    writer.putMovNearPtrReg(successPtr, 'eax')
    //     POPFD
    //     POPAD
    writer.putPopax();
    writer.putPopfx();
    writer.putRet()
    writer.flush();

  })

  // console.info('----------txtAsm', txtAsm)
  const nativeativeFunction = new NativeFunction(ptr(txtAsm), 'void', [])
  try {
    nativeativeFunction()
    console.info('[设置联系人备注] successPtr:', successPtr.readS32())
  } catch (e) {
    console.error('[设置联系人备注]Error:', e)
  }

}
// 示例调用
// modifyContactRemarkFunction("ledongmao", "超哥xxxxx");

// 获取联系人头像——待测试，2024-03-13，call和实现方法来源于ttttupup/wxhelper项目
const getHeadImage = (contactId: string, url: string) => {

  const txtAsm: any = Memory.alloc(Process.pageSize)

  const wxidPtr: any = Memory.alloc(contactId.length * 2 + 2)
  wxidPtr.writeUtf16String(contactId)

  const contact = Memory.alloc(0x0c)
  contact.writePointer(ptr(wxidPtr)).add(0x04)
    .writeU32(contactId.length * 2).add(0x04)
    .writeU32(contactId.length * 2).add(0x04)

  const contentPtr = Memory.alloc(url.length * 2 + 2)
  contentPtr.writeUtf16String(url)

  const sizeOfStringStruct = Process.pointerSize * 5
  const img_url = Memory.alloc(sizeOfStringStruct)

  img_url
    .writePointer(contentPtr).add(0x4)
    .writeU32(url.length).add(0x4)
    .writeU32(url.length * 2)

  // const ecxBuffer = Memory.alloc(0x2d8)
  const head_image_mgr_addr = moduleBaseAddress.add(wxOffsets.contact.WX_HEAD_IMAGE_MGR_OFFSET);
  const get_img_download_addr = moduleBaseAddress.add(wxOffsets.contact.QUERY_THEN_DOWNLOAD_OFFSET);
  const temp = Memory.alloc(0x8);

  Memory.patchCode(txtAsm, Process.pageSize, code => {
    const writer = new X86Writer(code, {
      pc: txtAsm,
    })

    writer.putPushfx();
    writer.putPushax();
    writer.putCallAddress(head_image_mgr_addr);
    writer.putMovRegAddress('ecx', img_url);
    writer.putPushReg('ecx');
    writer.putMovRegAddress('ecx', contact);
    writer.putPushReg('ecx');
    writer.putMovRegAddress('ecx', temp);
    writer.putPushReg('ecx');
    // 执行MOV ECX,EAX,将EAX（由head_image_mgr_addr函数返回的值）移动到ECX，用于下一个函数调用
    writer.putMovRegReg('ecx', 'eax');
    writer.putCallAddress(get_img_download_addr);
    // writer.putAddRegImm('esp', 0x18);
    writer.putPopax();
    writer.putPopfx();
    writer.putRet()
    writer.flush();

  })

  // console.info('----------txtAsm', txtAsm)
  const nativeativeFunction = new NativeFunction(ptr(txtAsm), 'void', [])
  const head_img = nativeativeFunction()
  console.info('head_img:', head_img)
  return head_img
}

// 添加好友——未实现,2024-03-13，会报错
const addFriendByWxid = (contactId: string, text: string) => {

  const txtAsm: any = Memory.alloc(Process.pageSize)

  const wxidPtr: any = Memory.alloc(contactId.length * 2 + 2)
  wxidPtr.writeUtf16String(contactId)

  const user_id = Memory.alloc(0x0c)
  user_id.writePointer(ptr(wxidPtr)).add(0x04)
    .writeU32(contactId.length * 2).add(0x04)
    .writeU32(contactId.length * 2).add(0x04)

  const contentPtr = Memory.alloc(text.length * 2 + 2)
  contentPtr.writeUtf16String(text)

  const sizeOfStringStruct = Process.pointerSize * 5
  const w_msg = Memory.alloc(sizeOfStringStruct)

  w_msg
    .writePointer(contentPtr).add(0x4)
    .writeU32(text.length).add(0x4)
    .writeU32(text.length * 2)

  // const ecxBuffer = Memory.alloc(0x2d8)

  let success = -1;
  const contact_mgr_addr = moduleBaseAddress.add(wxOffsets.contactMgr.WX_CONTACT_MGR_OFFSET);
  const verify_msg_addr = moduleBaseAddress.add(wxOffsets.contact.WX_VERIFY_MSG_OFFSET);
  const set_value_addr = moduleBaseAddress.add(wxOffsets.setChatMsgValue.WX_INIT_CHAT_MSG_OFFSET);
  const do_verify_user_addr = moduleBaseAddress.add(wxOffsets.contact.WX_DO_VERIFY_USER_OFFSET);
  const fn1_addr = moduleBaseAddress.add(0x7591b0);

  // 创建未知结构体null_obj，并初始化
  const nullObjSize = 24; // 根据C++代码中Unkown结构体的大小进行调整
  const nullObj = Memory.alloc(nullObjSize);
  nullObj.writeByteArray([0, 0, 0, 0, 0, 0, 0xF]); // 根据C++代码中的初始化逻辑进行调整

  Memory.patchCode(txtAsm, Process.pageSize, code => {
    const writer = new X86Writer(code, {
      pc: txtAsm,
    })

    // PUSHAD
    // PUSHFD
    writer.putPushfx();
    writer.putPushax();

    // 调用contact_mgr_addr函数获取实例
    writer.putCallAddress(contact_mgr_addr);

    // 根据C++代码逻辑设置EDI, ESI和其他参数
    // 注意：这部分逻辑可能需要根据实际情况调整
    writer.putSubRegImm('edi', 0xE);
    writer.putSubRegImm('esi', 0x8);

    // 这里使用临时栈空间的逻辑需要特别注意，因为在Frida中直接操作ESP可能不是最佳实践
    // 如果fn1_addr函数对ESP的操作是必需的，那么需要确保在Frida脚本中正确模拟
    // 可能需要创建一个足够大的buffer来模拟这部分内存操作，而不是直接操作ESP

    // 调用fn1_addr函数
    writer.putCallAddress(fn1_addr);

    // 准备verify_msg_addr函数的参数
    writer.putMovRegAddress('eax', w_msg);
    writer.putPushReg('eax');
    writer.putCallAddress(verify_msg_addr);

    // 准备set_value_addr函数的参数
    writer.putMovRegPtrReg('eax', wxidPtr);
    writer.putPushReg('eax');
    writer.putCallAddress(set_value_addr);

    // 调用do_verify_user_addr函数
    writer.putCallAddress(do_verify_user_addr);

    // POPFD         
    // POPAD
    writer.putPopax();
    writer.putPopfx();
    writer.putRet()
    writer.flush();

  })

  // console.info('----------txtAsm', txtAsm)
  const nativeativeFunction = new NativeFunction(ptr(txtAsm), 'int', [])
  try {
    success = nativeativeFunction()
  } catch (e) {
    console.error('Error during function execution:', e);
    return '';
  }

}
// addFriendByWxid('ledongmao', 'hello')

// 获取群组列表
const getChatroomMemberInfoFunction = () => {
  // 获取群组列表地址
  const getChatroomNodeAddress = () => {
    const baseAddress = moduleBaseAddress.add(wxOffsets.storage.CONTACT_G_PINSTANCE_OFFSET).readPointer()
    if (baseAddress.isNull()) {
      return baseAddress
    }
    return baseAddress.add(0x8c8).readPointer()
  }

  // 递归遍历群组节点
  const chatroomRecurse = (node: NativePointer, chatroomNodeList: any[], chatroomMemberList: any[]) => {
    const chatroomNodeAddress = getChatroomNodeAddress()
    if (chatroomNodeAddress.isNull() || node.equals(chatroomNodeAddress)) {
      return
    }

    if (chatroomNodeList.some((n: any) => node.equals(n))) {
      return
    }

    chatroomNodeList.push(node)
    const roomid = readWideString(node.add(0x10))
    // try{
    //   console.info('获取群信息...', roomid)
    //   GetMemberFromChatRoom(roomid)
    // }catch(e){
    //   console.error('获取群信息失败：', e)
    // }
    const len = node.add(0x54).readU32()
    if (len > 4) {
      const memberStr: any = readString(node.add(0x44))
      if (memberStr.length > 0) {
        const admin = readWideString(node.add(0x74))
        // console.info('获取到的admin', admin)
        const memberList = memberStr.split(/[\\^][G]/)
        chatroomMemberList.push({ roomid, roomMember: memberList, admin })
      }
    }

    chatroomRecurse(node.add(0x0).readPointer(), chatroomNodeList, chatroomMemberList)
    chatroomRecurse(node.add(0x04).readPointer(), chatroomNodeList, chatroomMemberList)
    chatroomRecurse(node.add(0x08).readPointer(), chatroomNodeList, chatroomMemberList)
  }

  // 主函数逻辑
  const chatroomNodeAddress = getChatroomNodeAddress()
  if (chatroomNodeAddress.isNull()) {
    return '[]'
  }

  const chatroomNodeList: never[] = []
  const chatroomMemberList: never[] = []
  const startNode = chatroomNodeAddress.add(0x0).readPointer()
  chatroomRecurse(startNode, chatroomNodeList, chatroomMemberList)
  let results = '[]'
  try {
    results = JSON.stringify(chatroomMemberList)
    // console.info('群组列表：', results)
  } catch (e) {
    console.info('格式转换错误：', 'e')
  }
  return results
}

// 获取群成员昵称
let memberNickBuffAsm: any = null
let nickRoomId: any = null
let nickMemberId: any = null
let nickBuff: any = null
const getChatroomMemberNickInfoFunction = ((memberId: any, roomId: any) => {
  // console.info('Function called with wxid:', memberId, 'chatRoomId:', roomId);
  nickBuff = Memory.alloc(0x7e4)
  //const nickRetAddr = Memory.alloc(0x04)
  memberNickBuffAsm = Memory.alloc(Process.pageSize)
  //console.info('asm address----------',memberNickBuffAsm)
  nickRoomId = initidStruct(roomId)
  //console.info('nick room id',nickRoomId)
  nickMemberId = initidStruct(memberId)

  //console.info('nick nickMemberId id',nickMemberId)
  //const nickStructPtr = initmsgStruct('')

  Memory.patchCode(memberNickBuffAsm, Process.pageSize, code => {
    var cw = new X86Writer(code, {
      pc: memberNickBuffAsm
    })

    cw.putPushfx()
    cw.putPushax()
    cw.putMovRegAddress('edi', nickRoomId)
    cw.putMovRegAddress('eax', nickBuff)
    cw.putMovRegReg('edx', 'edi')
    cw.putPushReg('eax')
    cw.putMovRegAddress('ecx', nickMemberId)
    // console.info('moduleBaseAddress', moduleBaseAddress)
    cw.putCallAddress(moduleBaseAddress.add(0xC06F10))
    cw.putAddRegImm('esp', 0x04)

    cw.putPopax()
    cw.putPopfx()
    cw.putRet()
    cw.flush()

  })

  const nativeativeFunction = new NativeFunction(ptr(memberNickBuffAsm), 'void', [])
  nativeativeFunction()
  const nickname = readWideString(nickBuff)
  // console.info('--------------------------nickname', nickname)
  return nickname
})
// getChatroomMemberNickInfoFunction('xxx', 'xxx@chatroom')

// 移除群成员——未完成,2024-03-13，会导致微信崩溃
const delMemberFromChatRoom = (chat_room_id: string, wxids: string[]) => {
  let success: any = 0
  const txtAsm: any = Memory.alloc(Process.pageSize)
  const get_chat_room_mgr_addr = moduleBaseAddress.add(wxOffsets.chatRoomMgr.WX_CHAT_ROOM_MGR_OFFSET);
  const del_member_addr = moduleBaseAddress.add(wxOffsets.chatRoom.WX_DEL_CHAT_ROOM_MEMBER_OFFSET);
  const init_chat_msg_addr = moduleBaseAddress.add(wxOffsets.setChatMsgValue.WX_INIT_CHAT_MSG_OFFSET);
  const chatRoomPtr = Memory.allocUtf16String(chat_room_id);
  const membersBuffer = Memory.alloc(Process.pointerSize * (wxids.length + 1));
  for (let i = 0; i < wxids.length; i++) {
    const wxidPtr = Memory.allocUtf16String(wxids[i]);
    membersBuffer.add(Process.pointerSize * i).writePointer(wxidPtr);
  }
  membersBuffer.add(Process.pointerSize * wxids.length).writePointer(NULL); // 确保数组以NULL结尾


  Memory.patchCode(txtAsm, Process.pageSize, code => {
    const writer = new X86Writer(code, {
      pc: txtAsm,
    })
    writer.putPushfx();
    writer.putPushax();

    console.info('get_chat_room_mgr_addr:', get_chat_room_mgr_addr)
    writer.putCallAddress(get_chat_room_mgr_addr);
    writer.putSubRegImm('esp', 0x14);
    writer.putMovRegReg('esi', 'eax');
    // writer.putMovRegReg('ecx', 'esp');
    console.info('chat_room:', chatRoomPtr)
    writer.putMovRegAddress('ecx', chatRoomPtr);
    writer.putPushReg('ecx');

    console.info('init_chat_msg_addr:', init_chat_msg_addr)
    writer.putCallAddress(init_chat_msg_addr);
    writer.putMovRegReg('ecx', 'esi');

    console.info('membersBuffer:', membersBuffer)
    writer.putMovRegAddress('eax', membersBuffer);
    writer.putPushReg('eax');
    console.info('del_member_addr:', del_member_addr)
    writer.putCallAddress(del_member_addr);

    console.info('putPopax:', 'putPopax')
    writer.putPopax();
    writer.putPopfx();

    writer.putRet()
    writer.flush();
    console.info('writer.flush();')
  })

  console.info('----------txtAsm', txtAsm)
  // 调用刚才写入的汇编代码
  const nativeFunction = new NativeFunction(ptr(txtAsm), 'int', []);
  try {
    success = nativeFunction();
    console.info('[踢出群聊]delMemberFromChatRoom success:', success);
    return success;
  } catch (e) {
    console.error('[踢出群聊]Error during delMemberFromChatRoom nativeFunction function execution:', e);
    return false;
  }

}
// delMemberFromChatRoom('21341182572@chatroom', ['ledongmao'])

// 未完成，添加群成员
const addMemberToChatRoom = (chat_room_id: string, wxids: any[]) => {
  const base_addr = moduleBaseAddress; // 假设基础地址已经定义好
  const chat_room = Memory.allocUtf16String(chat_room_id);
  const members = wxids.map((id: string) => Memory.allocUtf16String(id));
  const membersBuffer = Memory.alloc(Process.pointerSize * (members.length + 2));
  membersBuffer.writePointer(NULL);
  membersBuffer.add(Process.pointerSize).writePointer(membersBuffer.add(Process.pointerSize * 2));

  for (let i = 0; i < members.length; i++) {
    membersBuffer.add(Process.pointerSize * (2 + i)).writePointer(members[i]);
  }

  const get_chat_room_mgr_addr = base_addr.add(wxOffsets.chatRoomMgr.WX_CHAT_ROOM_MGR_OFFSET);
  const add_member_addr = base_addr.add(wxOffsets.chatRoom.WX_ADD_MEMBER_TO_CHAT_ROOM_OFFSET);
  const init_chat_msg_addr = base_addr.add(wxOffsets.setChatMsgValue.WX_INIT_CHAT_MSG_OFFSET);
  const txtAsm: any = Memory.alloc(Process.pageSize);

  Memory.patchCode(txtAsm, Process.pageSize, code => {
    const writer = new X86Writer(code, { pc: txtAsm });
    writer.putPushax();
    writer.putPushfx();
    writer.putCallAddress(get_chat_room_mgr_addr);
    writer.putSubRegImm('esp', 0x8);
    writer.putMovRegReg('ebx', 'eax'); // 存储 get_chat_room_mgr_addr 调用的结果到 EBX
    const tempPtr = Memory.alloc(8); // 分配 8 字节以包含 tempPtr 和 tempPtr + 4
    writer.putMovRegU32('eax', 0x0);
    writer.putMovRegAddress('ecx', tempPtr);
    writer.putMovRegPtrReg('ecx', 'eax'); // 将 EAX (0x0) 写入 tempPtr 指向的地址
    writer.putLeaRegRegOffset('ecx', 'ecx', 4); // 加载 tempPtr + 4 的地址到 ECX
    writer.putMovRegPtrReg('ecx', 'eax'); // 将 EAX (0x0) 写入 ECX 指向的地址（tempPtr + 4）
    writer.putTestRegReg('esi', 'esi');
    writer.putSubRegImm('esp', 0x14);
    writer.putMovRegAddress('ecx', chat_room);
    writer.putPushReg('eax');
    writer.putCallAddress(init_chat_msg_addr);
    writer.putMovRegReg('ecx', 'ebx'); // 使用 EBX 替代 temp
    writer.putMovRegAddress('eax', membersBuffer.add(Process.pointerSize));
    writer.putPushReg('eax');
    writer.putCallAddress(add_member_addr);
    writer.putPopfx();
    writer.putPopax();
    writer.flush();
  });

  const nativeFunction = new NativeFunction(ptr(txtAsm), 'void', []);
  try {
    const success = nativeFunction();
    console.info('success:', success);
    return success;
  } catch (e) {
    console.error('[添加群成员]Error during addMemberToChatRoom nativeFunction function execution:', e);
    return false;

  }
};
// addMemberToChatRoom('21341182572@chatroom', ['ledongmao'])

// 未完成，邀请群成员
const inviteMemberToChatRoom = (chat_room_id: string, wxids: any[]) => {
  console.info('chat_room_id:', chat_room_id, 'wxids:', wxids);
  const base_addr = moduleBaseAddress; // 假设基础地址已经定义好
  const chat_room = Memory.allocUtf16String(chat_room_id);
  const members = wxids.map((id: string) => Memory.allocUtf16String(id));
  const membersBuffer = Memory.alloc(Process.pointerSize * (members.length + 2));
  membersBuffer.writePointer(NULL);
  membersBuffer.add(Process.pointerSize).writePointer(membersBuffer.add(Process.pointerSize * 2));

  for (let i = 0; i < members.length; i++) {
    membersBuffer.add(Process.pointerSize * (2 + i)).writePointer(members[i]);
  }

  const get_chat_room_mgr_addr = base_addr.add(wxOffsets.chatRoomMgr.WX_CHAT_ROOM_MGR_OFFSET);
  const invite_addr = base_addr.add(0xbd1a00); // 示例偏移量
  const get_share_record_mgr_addr = base_addr.add(wxOffsets.shareRecordMgr.WX_SHARE_RECORD_MGR_OFFSET);
  const init_chat_msg_addr = base_addr.add(wxOffsets.setChatMsgValue.WX_INIT_CHAT_MSG_OFFSET);
  const fn1 = base_addr.add(0x7f99d0); // 示例偏移量
  const fn2 = base_addr.add(0x78cef0); // 示例偏移量
  const fn3 = base_addr.add(0x7fa980); // 示例偏移量
  const fn4 = base_addr.add(0x755060); // 示例偏移量

  const sys_addr = base_addr.add(0x116C); // 示例偏移量
  const addr = Memory.alloc(Process.pointerSize * 2);
  addr.writePointer(sys_addr);
  addr.add(Process.pointerSize).writePointer(NULL);

  const txtAsm: any = Memory.alloc(Process.pageSize);

  Memory.patchCode(txtAsm, Process.pageSize, code => {
    const writer = new X86Writer(code, { pc: txtAsm });
    writer.putPushax();
    writer.putPushfx();
    writer.putCallAddress(get_share_record_mgr_addr);
    writer.putMovRegAddress('ecx', addr);
    writer.putPushReg('ecx');
    writer.putMovRegReg('ecx', 'eax');
    writer.putCallAddress(fn1);
    writer.putCallAddress(get_chat_room_mgr_addr);
    writer.putSubRegImm('esp', 0x8);
    writer.putMovRegAddress('eax', addr);
    writer.putMovRegAddress('ecx', txtAsm.add(8)); // 使用 txtAsm 的一部分来模拟栈
    writer.putPushReg('eax');
    writer.putCallAddress(fn2);
    writer.putSubRegImm('esp', 0x14);
    writer.putMovRegAddress('ecx', txtAsm.add(24)); // 使用 txtAsm 的另一部分来模拟栈
    writer.putMovRegAddress('eax', chat_room);
    writer.putPushReg('eax');
    writer.putCallAddress(init_chat_msg_addr);
    writer.putMovRegAddress('eax', membersBuffer.add(Process.pointerSize));
    writer.putPushReg('eax');
    writer.putCallAddress(invite_addr);
    writer.putCallAddress(get_share_record_mgr_addr);
    writer.putPushU32(0x0);
    writer.putPushU32(0x1);
    writer.putMovRegReg('ecx', 'eax');
    writer.putCallAddress(fn3);
    writer.putMovRegAddress('ecx', addr);
    writer.putCallAddress(fn4);
    writer.putPopfx();
    writer.putPopax();
    writer.flush();
  });

  const nativeFunction = new NativeFunction(ptr(txtAsm), 'void', []);
  try {
    const success = nativeFunction();
    return success;
  } catch (e) {
    console.error('[邀请进群]Error during inviteMemberToChatRoom nativeFunction function execution:', e);
    return false;
  }
};

// inviteMemberToChatRoom('21341182572@chatroom', ['ledongmao'])

// 发送文本消息
const sendMsgNativeFunction = (talkerId: any, content: any) => {

  const txtAsm: any = Memory.alloc(Process.pageSize)
  // const buffwxid = Memory.alloc(0x20)

  const wxidPtr: any = Memory.alloc(talkerId.length * 2 + 2)
  wxidPtr.writeUtf16String(talkerId)

  const picWxid = Memory.alloc(0x0c)
  picWxid.writePointer(ptr(wxidPtr)).add(0x04)
    .writeU32(talkerId.length * 2).add(0x04)
    .writeU32(talkerId.length * 2).add(0x04)

  const contentPtr = Memory.alloc(content.length * 2 + 2)
  contentPtr.writeUtf16String(content)

  const sizeOfStringStruct = Process.pointerSize * 5
  const contentStruct = Memory.alloc(sizeOfStringStruct)

  contentStruct
    .writePointer(contentPtr).add(0x4)
    .writeU32(content.length).add(0x4)
    .writeU32(content.length * 2)

  const ecxBuffer = Memory.alloc(0x2d8)

  Memory.patchCode(txtAsm, Process.pageSize, code => {
    const cw = new X86Writer(code, {
      pc: txtAsm,
    })
    cw.putPushfx()
    cw.putPushax()

    cw.putPushU32(0x0)
    cw.putPushU32(0x0)
    cw.putPushU32(0x0)
    cw.putPushU32(0x1)
    cw.putPushU32(0x0)

    // cw.putMovRegReg

    cw.putMovRegAddress('eax', contentStruct)
    cw.putPushReg('eax')

    cw.putMovRegAddress('edx', picWxid) // room_id

    cw.putMovRegAddress('ecx', ecxBuffer)
    cw.putCallAddress(moduleBaseAddress.add(
      wxOffsets.sendText.WX_SEND_TEXT_OFFSET,
    ))

    cw.putAddRegImm('esp', 0x18)
    cw.putPopax()
    cw.putPopfx()
    cw.putRet()
    cw.flush()

  })

  // console.info('----------txtAsm', txtAsm)
  const nativeativeFunction = new NativeFunction(ptr(txtAsm), 'void', [])
  nativeativeFunction()

}

// 发送@消息
let asmAtMsg: any = null
let roomid_: NativePointerValue, msg_: NativePointerValue, wxid_, atid_: NativePointerValue
let ecxBuffer: NativePointerValue
const sendAtMsgNativeFunction = ((roomId: any, text: string | string[], contactId: any, nickname: string) => {
  // console.info('Function called with roomId:', roomId, 'text:', text, 'contactId:', contactId, 'nickname:', nickname)
  asmAtMsg = Memory.alloc(Process.pageSize)
  ecxBuffer = Memory.alloc(0x3b0)
  // console.info('xxxx', text.indexOf('@'+nickname))
  const atContent = text.indexOf('@' + nickname) !== -1 ? text : ('@' + nickname + ' ' + text)

  roomid_ = initStruct(roomId)
  wxid_ = initidStruct(contactId)
  msg_ = initmsgStruct(atContent)
  atid_ = initAtMsgStruct(wxid_)

  Memory.patchCode(asmAtMsg, Process.pageSize, code => {
    var cw = new X86Writer(code, {
      pc: asmAtMsg
    })
    cw.putPushfx()
    cw.putPushax()

    cw.putPushU32(0x0)
    cw.putPushU32(0x0)
    cw.putPushU32(0x0)
    cw.putPushU32(0x1)
    //cw.putPushU32(0x0)
    cw.putMovRegAddress('eax', atid_)
    cw.putPushReg('eax')

    //cw.putMovRegReg

    cw.putMovRegAddress('eax', msg_)
    cw.putPushReg('eax')

    cw.putMovRegAddress('edx', roomid_) //room_id

    cw.putMovRegAddress('ecx', ecxBuffer)
    cw.putCallAddress(moduleBaseAddress.add(
      wxOffsets.sendText.WX_SEND_TEXT_OFFSET
    ))

    cw.putAddRegImm('esp', 0x18)
    cw.putPopax()
    cw.putPopfx()
    cw.putRet()
    cw.flush()

  })

  //console.info('----------txtAsm', asmAtMsg)
  const nativeativeFunction = new NativeFunction(ptr(asmAtMsg), 'void', [])
  nativeativeFunction()

})

// sendAtMsgNativeFunction('21341182572@chatroom', new Date().toLocaleString(), 'atorber', '超哥')

// 发送图片消息
const sendPicMsgNativeFunction = (contactId: string, path: string) => {

  const picAsm: any = Memory.alloc(Process.pageSize)
  const buffwxid = Memory.alloc(0x20)
  const picbuff = Memory.alloc(0x2D8)

  const pathPtr = Memory.alloc(path.length * 2 + 1)
  pathPtr.writeUtf16String(path)

  const imagefilepath = Memory.alloc(0x24)
  imagefilepath.writePointer(pathPtr).add(0x04)
    .writeU32(path.length * 2).add(0x04)
    .writeU32(path.length * 2).add(0x04)

  const picWxidPtr: any = Memory.alloc(contactId.length * 2 + 1)
  picWxidPtr.writeUtf16String(contactId)

  const picWxid = Memory.alloc(0x0c)
  picWxid.writePointer(ptr(picWxidPtr)).add(0x04)
    .writeU32(contactId.length * 2).add(0x04)
    .writeU32(contactId.length * 2).add(0x04)

  // const test_offset1 = 0x701DC0;
  Memory.patchCode(picAsm, Process.pageSize, code => {
    const cw = new X86Writer(code, {
      pc: picAsm,
    })
    cw.putPushfx()
    cw.putPushax()
    cw.putCallAddress(moduleBaseAddress.add(
      wxOffsets.sendMessageMgr.WX_SEND_MESSAGE_MGR_OFFSET,
    ))
    cw.putMovRegReg('edx', 'eax') // 缓存

    cw.putSubRegImm('esp', 0x14)
    cw.putMovRegAddress('eax', buffwxid)
    cw.putMovRegReg('ecx', 'esp')
    cw.putMovRegAddress('edi', imagefilepath)
    cw.putPushReg('eax')
    cw.putCallAddress(moduleBaseAddress.add(
      wxOffsets.setChatMsgValue.WX_INIT_CHAT_MSG_OFFSET,
    ))

    cw.putMovRegReg('ecx', 'edx')
    cw.putMovRegAddress('eax', picWxid) //= lea
    cw.putMovRegAddress('edi', imagefilepath)
    cw.putPushReg('edi')
    cw.putPushReg('eax')
    cw.putMovRegAddress('eax', picbuff)
    cw.putPushReg('eax')

    cw.putMovRegAddress('edi', picWxid) // edi
    cw.putCallAddress(moduleBaseAddress.add(
      wxOffsets.sendImage.WX_SEND_IMAGE_OFFSET,
    ))

    cw.putPopax()
    cw.putPopfx()
    cw.putRet()
    cw.flush()

  })

  // console.info('----------picAsm',picAsm)
  const nativeativeFunction = new NativeFunction(ptr(picAsm), 'void', [])
  nativeativeFunction()

}

// 发送link消息——未完成
function sendLinkMsgNativeFunction(wxid: string, title: string, url: string, thumburl: string, senderId: string, senderName: string, digest: string) {
  console.info('Function called with wxid:', wxid, 'title:', title, 'url:', url, 'thumburl:', thumburl, 'senderId:', senderId, 'senderName:', senderName, 'digest:', digest);
  let success = -1;

  // 假设已经有了这些函数和基地址的相对偏移量
  const initChatMsgAddr = moduleBaseAddress.add(wxOffsets.setChatMsgValue.WX_INIT_CHAT_MSG_OFFSET); // 这些偏移量需要替换为实际的偏移量
  const appMsgMgrAddr = moduleBaseAddress.add(wxOffsets.appMsgMgr.WX_APP_MSG_MGR_OFFSET);
  const newItemAddr = moduleBaseAddress.add(wxOffsets.sendLink.NEW_MM_READ_ITEM_OFFSET);
  const freeItem2Addr = moduleBaseAddress.add(wxOffsets.sendLink.FREE_MM_READ_ITEM_2_OFFSET);
  const forwardPublicMsgAddr = moduleBaseAddress.add(wxOffsets.sendLink.FORWARD_PUBLIC_MSG_OFFSET);

  const buff = Memory.alloc(0x238);

  // 调用 newItemAddr 函数初始化 buff
  const newItem = new NativeFunction(newItemAddr, 'void', ['pointer']);
  newItem(buff);

  // 创建WeChatString对象
  const toUser = Memory.allocUtf16String(wxid);
  const wTitle = Memory.allocUtf16String(title);
  const wUrl = Memory.allocUtf16String(url);
  const wThumburl = Memory.allocUtf16String(thumburl);
  const wSender = Memory.allocUtf16String(senderId);
  const wName = Memory.allocUtf16String(senderName);
  const wDigest = Memory.allocUtf16String(digest);

  // 将WeChatString对象的地址复制到buff中的相应位置
  // 注意：这里的偏移量需要根据实际的结构体布局调整
  buff.add(0x4).writePointer(wTitle);
  buff.add(0x2c).writePointer(wUrl);
  buff.add(0x6c).writePointer(wThumburl);
  buff.add(0x94).writePointer(wDigest);
  buff.add(0x1A0).writePointer(wSender);
  buff.add(0x1B4).writePointer(wName);

  // 调用其他函数完成消息的转发
  try {
    const appMsgMgr = new NativeFunction(appMsgMgrAddr, 'pointer', [])();
    const initChatMsg = new NativeFunction(initChatMsgAddr, 'void', ['pointer', 'pointer']);
    initChatMsg(buff, toUser);

    const forwardPublicMsg = new NativeFunction(forwardPublicMsgAddr, 'int', ['pointer']);
    success = forwardPublicMsg(appMsgMgr);

    const freeItem2 = new NativeFunction(freeItem2Addr, 'void', ['pointer', 'int']);
    freeItem2(buff, 0);
  } catch (e) {
    console.error('Error during sendLinkMsgNativeFunction function execution:', e);
    return false;
  }

  return success;
}

// sendLinkMsgNativeFunction('ledongmao', '标题是测试', 'https://www.json.cn', 'C:\\Users\\tyutl\\Documents\\GitHub\\puppet-xp\\examples\\file\\message-cltngju1k0030wko48uiwa2qs-url-1.jpg', 'ledongmao', '超哥', '这是描述...')

// 接收消息回调
const recvMsgNativeCallback = (() => {

  const nativeCallback = new NativeCallback(() => { }, 'void', ['int32', 'pointer', 'pointer', 'pointer', 'pointer', 'int32'])
  const nativeativeFunction = new NativeFunction(nativeCallback, 'void', ['int32', 'pointer', 'pointer', 'pointer', 'pointer', 'int32'])

  try {
    Interceptor.attach(
      moduleBaseAddress.add(wxOffsets.hookMsg.WX_RECV_MSG_HOOK_OFFSET), {
      onEnter() {
        try {
          const addr = (this.context as any).ecx // 0xc30-0x08
          const msgType = addr.add(0x38).readU32()
          const isMyMsg = addr.add(0x3C).readU32() // add isMyMsg

          if (msgType > 0) {

            const talkerIdPtr = addr.add(0x48).readPointer()
            // console.info('txt msg',talkerIdPtr.readUtf16String())
            const talkerIdLen = addr.add(0x48 + 0x04).readU32() * 2 + 2

            const myTalkerIdPtr = Memory.alloc(talkerIdLen)
            Memory.copy(myTalkerIdPtr, talkerIdPtr, talkerIdLen)

            let contentPtr: any = null
            let contentLen = 0
            let myContentPtr: any = null
            // console.info('msgType', msgType)

            if (msgType === 3) { // pic path
              const thumbPtr = addr.add(0x19c).readPointer()
              const hdPtr = addr.add(0x1b0).readPointer()
              const thumbPath = thumbPtr.readUtf16String()
              const hdPath = hdPtr.readUtf16String()
              const picData = [
                thumbPath, //  PUPPET.types.Image.Unknown
                thumbPath, //  PUPPET.types.Image.Thumbnail
                hdPath, //  PUPPET.types.Image.HD
                hdPath, //  PUPPET.types.Image.Artwork
              ]
              const content = JSON.stringify(picData)
              console.info('pic msg', content)
              myContentPtr = Memory.allocUtf16String(content)
            } else {
              contentPtr = addr.add(0x70).readPointer()
              contentLen = addr.add(0x70 + 0x04).readU32() * 2 + 2
              myContentPtr = Memory.alloc(contentLen)
              Memory.copy(myContentPtr, contentPtr, contentLen)
            }

            //  console.info('----------------------------------------')
            //  console.info(msgType)
            //  console.info(contentPtr.readUtf16String())
            //  console.info('----------------------------------------')
            const groupMsgAddr = addr.add(0x174).readU32() //* 2 + 2
            let myGroupMsgSenderIdPtr: any = null
            if (groupMsgAddr === 0) { // weChatPublic is zero，type is 49

              myGroupMsgSenderIdPtr = Memory.alloc(0x10)
              myGroupMsgSenderIdPtr.writeUtf16String('null')

            } else {

              const groupMsgSenderIdPtr = addr.add(0x174).readPointer()
              const groupMsgSenderIdLen = addr.add(0x174 + 0x04).readU32() * 2 + 2
              myGroupMsgSenderIdPtr = Memory.alloc(groupMsgSenderIdLen)
              Memory.copy(myGroupMsgSenderIdPtr, groupMsgSenderIdPtr, groupMsgSenderIdLen)

            }

            const xmlNullPtr = addr.add(0x1f0).readU32() // 3.9.2.23
            let myXmlContentPtr: any = null
            if (xmlNullPtr === 0) {

              myXmlContentPtr = Memory.alloc(0x10)
              myXmlContentPtr.writeUtf16String('null')

            } else {
              const xmlContentPtr = addr.add(0x1f0).readPointer() // 3.9.2.23

              const xmlContentLen = addr.add(0x1f0 + 0x04).readU32() * 2 + 2
              myXmlContentPtr = Memory.alloc(xmlContentLen)
              Memory.copy(myXmlContentPtr, xmlContentPtr, xmlContentLen)
            }
            console.info('msgType', msgType)
            console.info('talkerId', myTalkerIdPtr.readUtf16String())
            console.info('content', myContentPtr.readUtf16String())
            console.info('groupMsgSenderId', myGroupMsgSenderIdPtr.readUtf16String())
            console.info('xmlContent', myXmlContentPtr.readUtf16String())
            console.info('isMyMsg', isMyMsg)
            setImmediate(() => nativeativeFunction(msgType, myTalkerIdPtr, myContentPtr, myGroupMsgSenderIdPtr, myXmlContentPtr, isMyMsg))
          }
        } catch (e: any) {
          console.error('接收消息回调失败：', e)
          throw new Error(e)
        }
      },
    })
    return nativeCallback
  } catch (e) {
    console.error('回调消息失败：')
    return null
  }

})()

const recvMsgNativeCallbackTest = () => {

  const nativeCallback = new NativeCallback(() => { }, 'void', ['int32', 'pointer', 'pointer', 'pointer', 'pointer', 'int32'])
  const nativeativeFunction = new NativeFunction(nativeCallback, 'void', ['int32', 'pointer', 'pointer', 'pointer', 'pointer', 'int32'])

  try {
    Interceptor.attach(
      moduleBaseAddress.add(wxOffsets.hookMsg.WX_RECV_MSG_HOOK_OFFSET), {
      onEnter() {
        try {
          const addr = (this.context as any).ecx // 0xc30-0x08
          const msgType = addr.add(0x38).readU32()
          const isMyMsg = addr.add(0x3C).readU32() // add isMyMsg

          if (msgType > 0) {

            const talkerIdPtr = addr.add(0x48).readPointer()
            // console.info('txt msg',talkerIdPtr.readUtf16String())
            const talkerIdLen = addr.add(0x48 + 0x04).readU32() * 2 + 2

            const myTalkerIdPtr = Memory.alloc(talkerIdLen)
            Memory.copy(myTalkerIdPtr, talkerIdPtr, talkerIdLen)

            let contentPtr: any = null
            let contentLen = 0
            let myContentPtr: any = null
            // console.info('msgType', msgType)

            if (msgType === 3) { // pic path
              const thumbPtr = addr.add(0x19c).readPointer()
              const hdPtr = addr.add(0x1b0).readPointer()
              const thumbPath = thumbPtr.readUtf16String()
              const hdPath = hdPtr.readUtf16String()
              const picData = [
                thumbPath, //  PUPPET.types.Image.Unknown
                thumbPath, //  PUPPET.types.Image.Thumbnail
                hdPath, //  PUPPET.types.Image.HD
                hdPath, //  PUPPET.types.Image.Artwork
              ]
              const content = JSON.stringify(picData)
              console.info('pic msg', content)
              myContentPtr = Memory.allocUtf16String(content)
            } else {
              contentPtr = addr.add(0x70).readPointer()
              contentLen = addr.add(0x70 + 0x04).readU32() * 2 + 2
              myContentPtr = Memory.alloc(contentLen)
              Memory.copy(myContentPtr, contentPtr, contentLen)
            }

            //  console.info('----------------------------------------')
            //  console.info(msgType)
            //  console.info(contentPtr.readUtf16String())
            //  console.info('----------------------------------------')
            const groupMsgAddr = addr.add(0x174).readU32() //* 2 + 2
            let myGroupMsgSenderIdPtr: any = null
            if (groupMsgAddr === 0) { // weChatPublic is zero，type is 49

              myGroupMsgSenderIdPtr = Memory.alloc(0x10)
              myGroupMsgSenderIdPtr.writeUtf16String('null')

            } else {

              const groupMsgSenderIdPtr = addr.add(0x174).readPointer()
              const groupMsgSenderIdLen = addr.add(0x174 + 0x04).readU32() * 2 + 2
              myGroupMsgSenderIdPtr = Memory.alloc(groupMsgSenderIdLen)
              Memory.copy(myGroupMsgSenderIdPtr, groupMsgSenderIdPtr, groupMsgSenderIdLen)

            }

            const xmlNullPtr = addr.add(0x1f0).readU32() // 3.9.2.23
            let myXmlContentPtr: any = null
            if (xmlNullPtr === 0) {

              myXmlContentPtr = Memory.alloc(0x10)
              myXmlContentPtr.writeUtf16String('null')

            } else {
              const xmlContentPtr = addr.add(0x1f0).readPointer() // 3.9.2.23

              const xmlContentLen = addr.add(0x1f0 + 0x04).readU32() * 2 + 2
              myXmlContentPtr = Memory.alloc(xmlContentLen)
              Memory.copy(myXmlContentPtr, xmlContentPtr, xmlContentLen)
            }

            // setImmediate(() => nativeativeFunction(msgType, myTalkerIdPtr, myContentPtr, myGroupMsgSenderIdPtr, myXmlContentPtr, isMyMsg))
          }
        } catch (e: any) {
          console.error('接收消息回调失败：', e)
          throw new Error(e)
        }
      },
    })
    return nativeCallback
  } catch (e) {
    console.error('回调消息失败：')
    return null
  }

}

recvMsgNativeCallbackTest()

// console.info('Process.enumerateThreads():', JSON.stringify(Process.enumerateThreads(), null, 2))
