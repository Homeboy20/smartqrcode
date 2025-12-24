'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Box, Heading, Text, Button, Input, VStack, HStack, useToast, Spinner, Image, Flex, Badge } from '@chakra-ui/react';
import { FiDownload, FiEye, FiLock } from 'react-icons/fi';
import { verifySharePassword, recordShareAccess, isShareExpired } from '@/lib/fileSharingService';

interface SharedFilePageProps {
  params: {
    id: string;
  };
}

export default function SharedFilePage({ params }: SharedFilePageProps) {
  const { id } = params;
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState<any>(null);
  const [shareInfo, setShareInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [expired, setExpired] = useState(false);
  
  useEffect(() => {
    if (!id) return;
    
    const fetchSharedFile = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/shared-files/${id}`);
        const data = await response.json();
        
        if (!data.success) {
          setError(data.error || 'File not found');
          setLoading(false);
          return;
        }
        
        setFileData(data.file);
        setShareInfo(data.shareInfo);
        
        setIsPasswordProtected(!!data.shareInfo.password);
        
        const isExpired = isShareExpired(data.shareInfo);
        setExpired(isExpired);
        
        if (!isExpired && !data.shareInfo.password) {
          await recordShareAccess(id);
        }
        
      } catch (error) {
        console.error('Error fetching shared file:', error);
        setError('An error occurred while fetching the file');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSharedFile();
  }, [id]);
  
  const handleVerifyPassword = async () => {
    if (!id || !password) return;
    
    try {
      const isValid = await verifySharePassword(id, password);
      
      if (isValid) {
        setIsPasswordVerified(true);
        await recordShareAccess(id);
        toast({
          title: 'Password verified',
          status: 'success',
          duration: 2000,
        });
      } else {
        toast({
          title: 'Invalid password',
          status: 'error',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      toast({
        title: 'Error verifying password',
        status: 'error',
        duration: 2000,
      });
    }
  };
  
  const handleDownload = async () => {
    if (!fileData || !shareInfo) return;
    
    try {
      const response = await fetch(`/api/download/${id}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Download started',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: 'Error downloading file',
        status: 'error',
        duration: 2000,
      });
    }
  };
  
  if (loading) {
    return (
      <Box textAlign="center" py={20}>
        <Spinner size="xl" />
        <Text mt={4}>Loading shared file...</Text>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box textAlign="center" py={20}>
        <Heading size="lg" color="red.500" mb={4}>Error</Heading>
        <Text>{error}</Text>
        <Button mt={6} onClick={() => window.location.href = '/'}>
          Go Home
        </Button>
      </Box>
    );
  }
  
  if (expired) {
    return (
      <Box textAlign="center" py={20}>
        <Heading size="lg" color="orange.500" mb={4}>Share Link Expired</Heading>
        <Text>This shared file link has expired and is no longer available.</Text>
        <Button mt={6} onClick={() => window.location.href = '/'}>
          Go Home
        </Button>
      </Box>
    );
  }
  
  if (isPasswordProtected && !isPasswordVerified) {
    return (
      <Box maxW="md" mx="auto" mt={20} p={8} borderWidth="1px" borderRadius="lg">
        <VStack spacing={6}>
          <Heading size="lg">Password Protected</Heading>
          <FiLock size={50} color="gray" />
          <Text>This file is password protected. Please enter the password to view it.</Text>
          
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <Button colorScheme="blue" onClick={handleVerifyPassword} w="full">
            Verify Password
          </Button>
        </VStack>
      </Box>
    );
  }
  
  if (!fileData || !shareInfo) return null;
  
  return (
    <Box maxW="4xl" mx="auto" p={4} mt={8}>
      <VStack spacing={6} align="stretch">
        <Flex justify="space-between" align="center">
          <Heading size="lg">{fileData.fileName}</Heading>
          <Badge 
            colorScheme={shareInfo.accessType === 'view' ? 'purple' : 'blue'} 
            fontSize="md" 
            px={2} 
            py={1}
          >
            {shareInfo.accessType === 'view' ? 
              <HStack><FiEye /><Text ml={1}>View Only</Text></HStack> : 
              <HStack><FiDownload /><Text ml={1}>Download Allowed</Text></HStack>
            }
          </Badge>
        </Flex>
        
        <Box p={4} borderWidth="1px" borderRadius="lg">
          {fileData.fileType.startsWith('image/') ? (
            <Image 
              src={`/api/file-content/${id}`} 
              alt={fileData.fileName}
              maxH="600px"
              mx="auto"
            />
          ) : fileData.fileType === 'application/pdf' ? (
            <Box height="600px" width="100%" border="1px solid" borderColor="gray.200">
              <iframe
                src={`/api/file-content/${id}`}
                style={{ width: '100%', height: '100%' }}
                title={fileData.fileName}
              />
            </Box>
          ) : (
            <Box p={4} bg="gray.50" borderRadius="md">
              <Text>Preview not available for this file type. {shareInfo.accessType === 'download' && 'You can download it using the button below.'}</Text>
            </Box>
          )}
        </Box>
        
        <Box>
          <Text fontSize="sm" color="gray.600">
            Size: {(fileData.fileSize / (1024 * 1024)).toFixed(2)} MB • Type: {fileData.fileType}
          </Text>
        </Box>
        
        {shareInfo.accessType === 'download' && (
          <Button 
            leftIcon={<FiDownload />} 
            colorScheme="blue" 
            onClick={handleDownload}
            size="lg"
            mx="auto"
            width="fit-content"
          >
            Download File
          </Button>
        )}
      </VStack>
    </Box>
  );
}
