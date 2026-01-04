import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useRouter } from 'next/navigation';
import { Button, Card, Heading, Text, Box, Flex, Input, Select, Switch, Badge, IconButton, VStack, HStack, useToast, Spinner, Tooltip } from '@chakra-ui/react';
import { FiLink, FiTrash2, FiCopy, FiEye, FiDownload, FiLock, FiUnlock, FiCalendar } from 'react-icons/fi';
import { getUserSharedFiles, revokeSharing, makeFilePublic, shareFileWithUsers } from '@/lib/fileSharingService';
import { format } from 'date-fns';

// Define proper types for the file sharing data
interface SharedFile {
  fileName: string;
  fileSize: number;
  fileType: string;
  id: string;
}

interface ShareInfo {
  id: string;
  createdAt: { seconds: number };
  expiresAt?: { seconds: number };
  password?: string;
  sharedWith: string;
  accessCount: number;
  accessType: 'view' | 'download';
}

interface SharedFileProps {
  shareInfo: ShareInfo;
  file: SharedFile;
  onRevoke: (shareId: string) => void;
}

const SharedFileCard: React.FC<SharedFileProps> = ({ shareInfo, file, onRevoke }) => {
  const toast = useToast();
  const [copying, setCopying] = useState(false);

  const shareUrl = `${window.location.origin}/shared/${shareInfo.id}`;
  
  const copyShareLink = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Failed to copy link',
        status: 'error',
        duration: 2000,
      });
    } finally {
      setCopying(false);
    }
  };

  const formatDate = (timestamp: { seconds: number } | undefined) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp.seconds * 1000);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const isExpired = shareInfo.expiresAt ? new Date() > new Date(shareInfo.expiresAt.seconds * 1000) : false;

  return (
    <Card p={4} mb={3} borderWidth="1px" borderRadius="lg">
      <Flex direction="column">
        <Flex justify="space-between" align="center" mb={2}>
          <Heading size="sm" isTruncated maxW="70%">{file.fileName}</Heading>
          <HStack>
            {shareInfo.password && <Tooltip label="Password protected"><FiLock /></Tooltip>}
            {shareInfo.sharedWith === 'public' ? (
              <Badge colorScheme="green">Public</Badge>
            ) : (
              <Badge colorScheme="blue">Shared with {shareInfo.sharedWith}</Badge>
            )}
            {isExpired && <Badge colorScheme="red">Expired</Badge>}
          </HStack>
        </Flex>
        
        <Text fontSize="sm" color="gray.600" mb={2}>
          Size: {(file.fileSize / 1024).toFixed(1)} KB • Type: {file.fileType}
        </Text>
        
        <Flex justify="space-between" fontSize="xs" color="gray.500" mb={3}>
          <Text>Shared: {formatDate(shareInfo.createdAt)}</Text>
          <Text>Accessed: {shareInfo.accessCount} times</Text>
          {shareInfo.expiresAt && (
            <Text>Expires: {formatDate(shareInfo.expiresAt)}</Text>
          )}
        </Flex>
        
        <Flex justify="space-between">
          <HStack>
            <IconButton
              aria-label="Copy share link"
              icon={copying ? <Spinner size="sm" /> : <FiCopy />}
              size="sm"
              onClick={copyShareLink}
            />
            <Badge colorScheme={shareInfo.accessType === 'view' ? 'purple' : 'orange'}>
              {shareInfo.accessType === 'view' ? <FiEye /> : <FiDownload />}
              {shareInfo.accessType === 'view' ? ' View only' : ' Download allowed'}
            </Badge>
          </HStack>
          
          <IconButton
            aria-label="Revoke sharing"
            icon={<FiTrash2 />}
            colorScheme="red"
            size="sm"
            onClick={() => onRevoke(shareInfo.id)}
          />
        </Flex>
      </Flex>
    </Card>
  );
};

const FileSharing: React.FC = () => {
  const { user } = useAuth();
  const { subscriptionTier } = useSubscription();
  const router = useRouter();
  const toast = useToast();
  
  const [sharedFiles, setSharedFiles] = useState<{ file: SharedFile; shareInfo: ShareInfo }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareForm, setShowShareForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [shareEmails, setShareEmails] = useState('');
  const [accessType, setAccessType] = useState<'view' | 'download'>('view');
  const [isPublic, setIsPublic] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expirationDays, setExpirationDays] = useState(7);
  
  // Define loadSharedFiles with useCallback before using it in useEffect
  const loadSharedFiles = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const files = await getUserSharedFiles(user.uid);
      setSharedFiles(files);
    } catch (error) {
      console.error('Error loading shared files:', error);
      toast({
        title: 'Error loading shared files',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);
  
  useEffect(() => {
    // Redirect non-premium users
    if (user && subscriptionTier === 'free') {
      router.push('/pricing');
      toast({
        title: 'Premium Feature',
        description: 'File sharing is only available for premium users',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
    } else if (user) {
      loadSharedFiles();
    }
  }, [user, subscriptionTier, loadSharedFiles, router, toast]);
  
  const handleRevokeSharing = async (shareId: string) => {
    if (!user) return;
    
    try {
      await revokeSharing(shareId, user.uid);
      setSharedFiles(prevFiles => prevFiles.filter(f => f.shareInfo.id !== shareId));
      toast({
        title: 'Sharing revoked',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error revoking sharing:', error);
      toast({
        title: 'Error revoking sharing',
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  const handleShareFile = async () => {
    if (!user || !selectedFile) return;
    
    try {
      let expirationDate: Date | undefined;
      if (useExpiration) {
        expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + expirationDays);
      }
      
      if (isPublic) {
        await makeFilePublic(
          selectedFile,
          user.uid,
          accessType,
          expirationDate,
          usePassword ? password : undefined
        );
        toast({
          title: 'File shared publicly',
          status: 'success',
          duration: 2000,
        });
      } else {
        const emails = shareEmails.split(',').map(e => e.trim()).filter(e => e);
        if (emails.length === 0) {
          toast({
            title: 'Please enter at least one email address',
            status: 'warning',
            duration: 2000,
          });
          return;
        }
        
        await shareFileWithUsers(
          selectedFile,
          user.uid,
          emails,
          accessType,
          expirationDate,
          usePassword ? password : undefined
        );
        toast({
          title: 'File shared successfully',
          description: `Shared with ${emails.length} recipients`,
          status: 'success',
          duration: 2000,
        });
      }
      
      // Reset form and reload shared files
      setShowShareForm(false);
      setSelectedFile(null);
      setShareEmails('');
      setAccessType('view');
      setIsPublic(false);
      setUsePassword(false);
      setPassword('');
      setUseExpiration(false);
      setExpirationDays(7);
      
      loadSharedFiles();
    } catch (error) {
      console.error('Error sharing file:', error);
      toast({
        title: 'Error sharing file',
        status: 'error',
        duration: 3000,
      });
    }
  };
  
  if (!user) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner />
        <Text mt={4}>Loading...</Text>
      </Box>
    );
  }
  
  if (subscriptionTier === 'free') {
    return (
      <Box textAlign="center" py={10}>
        <Heading size="md">Premium Feature</Heading>
        <Text mt={4}>File sharing is only available for premium users</Text>
        <Button mt={6} colorScheme="purple" onClick={() => router.push('/pricing')}>
          Upgrade Now
        </Button>
      </Box>
    );
  }
  
  return (
    <Box p={4}>
      <Heading size="lg" mb={6}>File Sharing</Heading>
      
      {loading ? (
        <Box textAlign="center" py={10}>
          <Spinner />
          <Text mt={4}>Loading your shared files...</Text>
        </Box>
      ) : (
        <>
          <Flex justify="space-between" align="center" mb={6}>
            <Text>{sharedFiles.length} shared files</Text>
            <Button 
              leftIcon={<FiLink />} 
              colorScheme="blue"
              onClick={() => {
                setShowShareForm(true);
                // In a real app, you'd need to also select a file to share
                // This would typically come from the user's files list
                // setSelectedFile(someFileId);
              }}
            >
              Share a File
            </Button>
          </Flex>
          
          {showShareForm && (
            <Card p={4} mb={6} borderWidth="1px" borderRadius="lg">
              <Heading size="md" mb={4}>Share a File</Heading>
              
              {!selectedFile ? (
                <Text color="red.500">Please select a file first from your files list</Text>
              ) : (
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Text fontWeight="bold" mb={1}>Share Type</Text>
                    <Switch 
                      isChecked={isPublic} 
                      onChange={() => setIsPublic(!isPublic)}
                      mr={2}
                    /> 
                    {isPublic ? "Public link" : "Share with specific people"}
                  </Box>
                  
                  {!isPublic && (
                    <Box>
                      <Text fontWeight="bold" mb={1}>Recipients</Text>
                      <Input 
                        placeholder="Enter email addresses, separated by commas" 
                        value={shareEmails}
                        onChange={(e) => setShareEmails(e.target.value)}
                      />
                    </Box>
                  )}
                  
                  <Box>
                    <Text fontWeight="bold" mb={1}>Access Type</Text>
                    <Select 
                      value={accessType}
                      onChange={(e) => setAccessType(e.target.value as 'view' | 'download')}
                    >
                      <option value="view">View only</option>
                      <option value="download">Allow download</option>
                    </Select>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="bold" mb={1}>Password Protection</Text>
                    <Switch 
                      isChecked={usePassword} 
                      onChange={() => setUsePassword(!usePassword)}
                      mr={2}
                    /> 
                    {usePassword ? "Enabled" : "Disabled"}
                    
                    {usePassword && (
                      <Input 
                        mt={2}
                        type="password" 
                        placeholder="Enter password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    )}
                  </Box>
                  
                  <Box>
                    <Text fontWeight="bold" mb={1}>Expiration</Text>
                    <Switch 
                      isChecked={useExpiration} 
                      onChange={() => setUseExpiration(!useExpiration)}
                      mr={2}
                    /> 
                    {useExpiration ? "Enabled" : "Never expires"}
                    
                    {useExpiration && (
                      <Select 
                        mt={2}
                        value={expirationDays}
                        onChange={(e) => setExpirationDays(parseInt(e.target.value))}
                      >
                        <option value={1}>1 day</option>
                        <option value={3}>3 days</option>
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                      </Select>
                    )}
                  </Box>
                  
                  <Flex justify="flex-end" mt={2}>
                    <Button 
                      mr={3} 
                      onClick={() => setShowShareForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      colorScheme="blue" 
                      onClick={handleShareFile}
                    >
                      Share
                    </Button>
                  </Flex>
                </VStack>
              )}
            </Card>
          )}
          
          {sharedFiles.length === 0 ? (
            <Box textAlign="center" py={10} borderWidth="1px" borderRadius="lg">
              <Text mb={4}>You haven&apos;t shared any files yet</Text>
              <Button 
                colorScheme="blue" 
                leftIcon={<FiLink />}
                onClick={() => {
                  setShowShareForm(true);
                  // In a real app, you'd need to also select a file to share
                }}
              >
                Share a File
              </Button>
            </Box>
          ) : (
            <VStack spacing={4} align="stretch">
              {sharedFiles.map((item) => (
                <SharedFileCard 
                  key={item.shareInfo.id}
                  shareInfo={item.shareInfo}
                  file={item.file}
                  onRevoke={handleRevokeSharing}
                />
              ))}
            </VStack>
          )}
        </>
      )}
    </Box>
  );
};

export default FileSharing; 