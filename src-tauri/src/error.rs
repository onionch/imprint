use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("IO错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("导入错误: {0}")]
    Import(String),
    #[error("模板错误: {0}")]
    Template(String),
    #[error("打印错误: {0}")]
    Print(String),
    #[error("参数错误: {0}")]
    Validation(String),
    #[error("未找到: {0}")]
    NotFound(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
