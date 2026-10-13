// 种子项目：新建默认模板时预置的常见项目（含识别关键词，值为空等用户填写）。
// 这样第一次扫描网站就能认出常规项目；不认识的会作为"新项目"让用户补充并学习。
window.SEED_ENTRIES = [
  { label: "姓名",            keywords: ["姓名","名字","真实姓名","联系人姓名","联系人","name","fullname","realname","contactname","username"] },
  { label: "性别",            keywords: ["性别","sex","gender"] },
  { label: "身份证号",        keywords: ["身份证","身份证号","身份证号码","证件号","idcard","idnumber","idno","identity"] },
  { label: "出生日期",        keywords: ["出生","出生日期","生日","birth","birthday","birthdate","dob"] },
  { label: "手机号",          keywords: ["手机","手机号","手机号码","联系电话","电话","联系方式","mobile","phone","tel","cellphone"] },
  { label: "电子邮箱",        keywords: ["邮箱","电子邮箱","邮件","email","mail","e-mail"] },
  { label: "联系地址",        keywords: ["地址","联系地址","通讯地址","家庭住址","address","addr"] },
  { label: "学历",            keywords: ["学历","最高学历","文化程度","education","degree"] },
  { label: "工作经历",        keywords: ["工作经历","工作经验","履历","工作履历","从业经历","experience","workexperience","resume"] },
  { label: "公司名称",        keywords: ["公司名称","公司全称","企业名称","单位名称","供应商名称","公司","企业","供应商","company","companyname","corporation","enterprise"] },
  { label: "公司简称",        keywords: ["公司简称","企业简称","简称","shortname","abbreviation"] },
  { label: "统一社会信用代码", keywords: ["统一社会信用代码","社会信用代码","信用代码","工商注册号","营业执照号","creditcode","taxid","uscc"] },
  { label: "法定代表人",      keywords: ["法定代表人","法人代表","法人","legalperson","legalrepresentative"] },
  { label: "公司注册地址",    keywords: ["注册地址","公司地址","企业地址","单位地址","办公地址","registeredaddress","companyaddress"] },
  { label: "注册资本",        keywords: ["注册资本","注册资金","registeredcapital","capital"] },
  { label: "开户银行",        keywords: ["开户行","开户银行","基本户","bankname","bank"] },
  { label: "银行账号",        keywords: ["银行账号","对公账号","账号","银行帐号","bankaccount","accountnumber"] },
  { label: "公司电话",        keywords: ["公司电话","单位电话","座机","固定电话","companytel","officephone"] },
  { label: "传真",            keywords: ["传真","fax"] },
  { label: "公司网址",        keywords: ["网址","公司网址","官网","website","url","homepage"] },
  { label: "经营范围",        keywords: ["经营范围","主营业务","businessscope","scope"] }
];
